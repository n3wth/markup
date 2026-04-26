import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createOrchestrator } from '../orchestrator'
import { saveChatMessage, updateSessionTitle } from '../lib/session-store'
import { events } from '../lib/analytics'
import type {
  AgentConfig,
  AgentState,
  AgentTask,
  EditProposalPayload,
  ExperimentSettings,
  Message,
  Session,
  TaskActionPayload,
  TimelineEntry,
} from '../types'
import type { Editor } from '@tiptap/react'
import { now, uid } from './useSession'

type OrchestratorHandle = ReturnType<typeof createOrchestrator>

/**
 * Inputs for {@link useOrchestratorWiring}. These come from sibling hooks:
 * `useMarkupEditor` owns the editor ref, `useSessionState` owns the session /
 * messages / tasks refs + setters, and App owns the pause toggle, the shared
 * orchestrator transport ref, and the agent list.
 */
export interface UseOrchestratorWiringOptions {
  editorRef: React.RefObject<Editor | null>
  messagesRef: React.RefObject<Message[]>
  activeAgents: AgentConfig[]
  activeSessionRef: React.RefObject<Session | null>
  agentsPausedRef: React.RefObject<boolean>
  /**
   * Shared cell holding the live orchestrator instance (or null while paused).
   * Declared at the App level because sibling hooks (`useMarkupEditor` for
   * user-typed `trigger`s, `useSession` for `doc-opened` after hydration)
   * also need to read from it.
   */
  orchestratorRef: React.MutableRefObject<OrchestratorHandle | null>
  setAgentStates: React.Dispatch<React.SetStateAction<Record<string, AgentState>>>
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEntry[]>>
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  setActiveSession: React.Dispatch<React.SetStateAction<Session | null>>
  experimentSettings?: ExperimentSettings
  tasksRef: React.RefObject<AgentTask[]>
  onTaskAction?: (agent: string, action: TaskActionPayload) => void
  /**
   * Chat stream — the hook watches this to forward new messages into
   * `orchestrator.onMessage()` so agents can react to each other.
   */
  messages: Message[]
  /**
   * Cursor that tracks how many `messages` have already been forwarded.
   * Owned by the caller (App.tsx) so session hydration can reset it to the
   * restored-message count and avoid replaying server-side history.
   */
  lastProcessedMsgRef: React.MutableRefObject<number>
  /**
   * Optional setter for an inline, non-toxic rate-limit hint displayed in the
   * chat panel. When rate_limit errors fire, the hook sets a short message
   * and clears it automatically after a short delay.
   */
  setRateLimitHint?: React.Dispatch<React.SetStateAction<string | null>>
}

export interface UseOrchestratorWiringResult {
  /**
   * Stable façade over the current orchestrator handle. Methods delegate to
   * whatever orchestrator is live at call time, so callers never need to
   * re-subscribe when the orchestrator is recreated after a pause/unpause or
   * agent-config change.
   */
  orchestrator: OrchestratorHandle
  /** Pause the orchestrator (destroys the current instance, clears agent states). */
  pause: () => void
}

/**
 * Wires App-level state into the orchestrator: subscribes the message /
 * task / edit-proposal / rename / error callbacks, creates the orchestrator
 * on mount (and on agent-config change), forwards new chat messages into
 * `orchestrator.onMessage`, and destroys the orchestrator on unmount.
 *
 * Extracted from App.tsx so the main component no longer owns the
 * orchestrator lifecycle. `useMarkupEditor` (W0-T008) and `useSessionState`
 * (W0-T009) supply the refs this hook needs.
 *
 * The returned `orchestrator` façade is stable across orchestrator
 * re-creations, so callers can pass the methods to `useCallback` deps
 * without causing re-subscribe churn.
 */
export function useOrchestratorWiring(
  options: UseOrchestratorWiringOptions,
): UseOrchestratorWiringResult {
  const {
    editorRef,
    messagesRef,
    activeAgents,
    activeSessionRef,
    agentsPausedRef,
    orchestratorRef,
    setAgentStates,
    setTimeline,
    setMessages,
    setSessions,
    setActiveSession,
    experimentSettings,
    tasksRef,
    onTaskAction,
    messages,
    lastProcessedMsgRef,
    setRateLimitHint,
  } = options
  const rateLimitHintTimerRef = useRef<number | null>(null)

  const pendingReasoning = useRef<Record<string, string[]>>({})
  const prevAgentsRef = useRef<AgentConfig[]>(activeAgents)
  const hasInitialized = useRef(false)

  // Keep the task-action callback addressable from within the orchestrator
  // config closure without retriggering orchestrator re-creation every time
  // App's `handleTaskAction` re-memoizes.
  const onTaskActionRef = useRef(onTaskAction)
  useEffect(() => { onTaskActionRef.current = onTaskAction })

  const makeOrchestrator = useCallback(() => {
    return createOrchestrator({
      getEditor: () => editorRef.current,
      getDocText: () => editorRef.current?.getText() || '',
      getMessages: () => messagesRef.current.slice(-10).map(m => ({ from: m.from, text: m.text })),
      agents: activeAgents,
      sessionTemplate: activeSessionRef.current?.template,
      experiments: experimentSettings,
      onAgentState: (agent, status, thought) => {
        setAgentStates(prev => ({
          ...prev,
          [agent]: { ...prev[agent] || { status: 'idle', inDoc: false }, status, thought },
        }))
      },
      onAgentReasoning: (agent, reasoning) => {
        pendingReasoning.current[agent] = reasoning
      },
      onDocAction: (agent, description) => {
        const agentCfg = activeAgents.find(a => a.name === agent)
        if (agentCfg) {
          setTimeline(t => [...t, { id: uid(), color: agentCfg.color, tooltip: description }].slice(-50))
        }
        const sessionId = activeSessionRef.current?.id || ''
        // Extract action type from description (e.g. "Aiden inserted content after:...")
        const actionType = description.match(/\b(insert|replace|read|image)\b/i)?.[1]?.toLowerCase() || 'edit'
        events.agentAction(sessionId, agent, actionType, true)
      },
      onChatMessage: (from, text) => {
        const reasoning = pendingReasoning.current[from]
        if (reasoning) delete pendingReasoning.current[from]
        setMessages(m => {
          const last = m[m.length - 1]
          if (last && last.from === from && last.text === text) return m
          const next = [...m, { id: uid(), from, text, time: now(), reasoning }]
          return next.length > 200 ? next.slice(-200) : next
        })
        const session = activeSessionRef.current
        if (session) {
          saveChatMessage(session.id, { sender: from, text, reasoning }).catch(err =>
            console.error('[App] saveChatMessage error:', err)
          )
        }
      },
      onProposal: (agent, proposalType, proposal) => {
        setMessages(prev => [...prev, {
          id: uid(),
          from: agent,
          text: proposal,
          time: now(),
          proposal: { type: proposalType as 'create-doc' | 'delete-doc' | 'add-agent' | 'remove-agent', description: proposal, status: 'pending' },
        }])
      },
      onProposedEdit: (agent: string, edit: EditProposalPayload) => {
        const preview =
          edit.kind === 'insert'
            ? `Proposed addition${edit.target ? ` (${edit.target})` : ''}.`
            : edit.kind === 'replace'
              ? `Proposed replacement.`
              : `Proposed deletion.`
        const rationale = edit.rationale?.trim()
        setMessages(prev => [...prev, {
          id: uid(),
          from: agent,
          text: rationale ? `${preview} ${rationale}` : preview,
          time: now(),
          proposal: { type: 'edit', edit, status: 'pending' },
        }])
      },
      getTasks: () => tasksRef.current,
      onTaskAction: (agent: string, action: TaskActionPayload) => {
        onTaskActionRef.current?.(agent, action)
      },
      onRenameSession: (title) => {
        const session = activeSessionRef.current
        if (session) {
          updateSessionTitle(session.id, title).catch(console.error)
          setSessions(s => s.map(x => x.id === session.id ? { ...x, title } : x))
          setActiveSession(s => s ? { ...s, title } : s)
        }
      },
      onError: (agent, error, failures) => {
        const sessionId = activeSessionRef.current?.id || ''
        events.agentError(sessionId, agent, error.code)
        if (error.code === 'rate_limit' && setRateLimitHint) {
          setRateLimitHint(`${agent} is pacing itself — slowing down for a moment.`)
          if (rateLimitHintTimerRef.current !== null) {
            window.clearTimeout(rateLimitHintTimerRef.current)
          }
          rateLimitHintTimerRef.current = window.setTimeout(() => {
            setRateLimitHint(null)
            rateLimitHintTimerRef.current = null
          }, 8000)
        }
        if (failures >= 3) {
          setMessages(m => [...m, {
            id: uid(),
            from: 'System',
            text: `Agent paused after ${failures} failures: ${error.message}`,
            time: now(),
          }])
        }
      },
    })
  }, [
    activeAgents,
    editorRef,
    messagesRef,
    activeSessionRef,
    setAgentStates,
    setTimeline,
    setMessages,
    setSessions,
    setActiveSession,
    experimentSettings,
    tasksRef,
    setRateLimitHint,
  ])

  useEffect(() => () => {
    if (rateLimitHintTimerRef.current !== null) {
      window.clearTimeout(rateLimitHintTimerRef.current)
      rateLimitHintTimerRef.current = null
    }
  }, [])

  // Orchestrator lifecycle: create on mount / on agent-config change, destroy
  // on unmount. Pause is handled by the caller via the returned `pause` fn,
  // which nulls the ref so this effect's cleanup skips the redundant destroy.
  useEffect(() => {
    if (agentsPausedRef.current) return

    const orch = makeOrchestrator()
    orchestratorRef.current = orch

    // Only trigger doc-opened on first init or agent config change (not on settings tweaks)
    const prevAgents = prevAgentsRef.current
    const agentsChanged = activeAgents.length !== prevAgents.length
      || activeAgents.some(a => !prevAgents.some(p => p.name === a.name))
    if (!hasInitialized.current || agentsChanged) {
      orch.trigger('doc-opened')
      hasInitialized.current = true
      if (agentsChanged && prevAgents.length > 0) {
        const newAgentNames = activeAgents.filter(a => !prevAgents.some(p => p.name === a.name)).map(a => a.name)
        if (newAgentNames.length > 0) {
          if (import.meta.env.DEV) console.log('[useOrchestratorWiring] new agents activated:', newAgentNames.join(', '))
          events.agentConfigChanged(activeAgents.length, activeAgents.map(a => a.name))
        }
      }
    }
    prevAgentsRef.current = activeAgents

    return () => {
      if (orchestratorRef.current === orch) {
        orch.destroy()
        orchestratorRef.current = null
      }
    }
  }, [makeOrchestrator, agentsPausedRef, orchestratorRef, activeAgents])

  // Forward newly-arrived chat messages into the orchestrator so agents can
  // react to each other. The cursor is owned by the caller so session
  // hydration (useSession.handleSessionSelect) can reset it to the restored
  // message count and skip replaying history.
  useEffect(() => {
    const newMsgs = messages.slice(lastProcessedMsgRef.current)
    lastProcessedMsgRef.current = messages.length
    for (const m of newMsgs) {
      orchestratorRef.current?.onMessage(m.from, m.text)
    }
  }, [messages, lastProcessedMsgRef, orchestratorRef])

  const pause = useCallback(() => {
    orchestratorRef.current?.destroy()
    orchestratorRef.current = null
    setAgentStates({})
  }, [orchestratorRef, setAgentStates])

  // Stable façade over the (possibly swapped) orchestrator instance. Methods
  // read through `orchestratorRef` at call time, so downstream `useCallback`
  // deps never churn just because the orchestrator was recreated after
  // pause/unpause or an agent-config change. `orchestratorRef` is a stable
  // ref, so this memo never invalidates.
  const orchestrator = useMemo<OrchestratorHandle>(() => ({
    trigger: (type, payload) => orchestratorRef.current?.trigger(type, payload),
    onMessage: (from, text) => orchestratorRef.current?.onMessage(from, text),
    applyApprovedEdit: (agent, payload) => orchestratorRef.current?.applyApprovedEdit(agent, payload),
    destroy: () => orchestratorRef.current?.destroy(),
  }), [orchestratorRef])

  return { orchestrator, pause }
}
