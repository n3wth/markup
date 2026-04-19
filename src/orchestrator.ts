import type { Editor } from '@tiptap/react'
import { events } from './lib/analytics'
import { askAgent, AgentError, resetRateLimiter, extractDocStructure, type AgentAction, type AskParams } from './agent'
import { verifyAndNormalizeAction } from './agent-verifier'
import { executeAgentAction, type ActionCallbacks } from './agent-actions'
import { generateObservation, resetHeartbeat } from './heartbeat'
import { classifyDocState, type DocState } from './templates'
import { DEFAULT_LIMITS, DEFAULT_EXPERIMENTS, type OrchestratorLimits, type AgentConfig, type EditProposalPayload, type ExperimentSettings, type TaskActionPayload, type AgentTask } from './types'
import { type PhaseState, initialPhaseState, phaseReducer, isActionAllowed } from './phase-machine'
import { getAgentMode } from './agent-modes'
import { detectObservations, resetWizard } from './wizard-of-oz'
import { createTurnQueue, type TurnRequest } from './orchestrator/turn-queue'

export type { AgentConfig }

type AgentName = string
type TriggerType = 'doc-opened' | 'user-message' | 'agent-tagged' | 'turn-complete' | 'heartbeat'

interface OrchestratorConfig {
  getEditor: () => Editor | null
  getDocText: () => string
  getMessages: () => { from: string, text: string }[]
  onAgentState: (agent: AgentName, status: 'idle' | 'thinking' | 'typing' | 'reading' | 'editing', thought?: string) => void
  onChatMessage: (from: string, text: string) => void
  onAgentReasoning?: (agent: AgentName, reasoning: string[]) => void
  onDocAction?: (agent: AgentName, description: string) => void
  onError?: (agent: AgentName, error: AgentError, consecutiveFailures: number) => void
  onSearchRequest?: (agent: AgentName, query: string) => void
  agents: AgentConfig[]
  demoMode?: boolean
  limits?: Partial<OrchestratorLimits>
  sessionTemplate?: string
  onRenameSession?: (newTitle: string) => void
  onProposal?: (agent: AgentName, proposalType: string, proposal: string) => void
  /** Review-first doc edits (not applied until user approves in UI) */
  onProposedEdit?: (agent: AgentName, payload: EditProposalPayload) => void
  /** Agent task actions (propose, complete, update) */
  onTaskAction?: (agent: AgentName, taskAction: TaskActionPayload) => void
  /** Current tasks for the session — used for task-aware turn selection */
  getTasks?: () => AgentTask[]
  onPhaseChange?: (phase: PhaseState) => void
  experiments?: Partial<ExperimentSettings>
}

interface OrchestratorHandle {
  trigger: (type: TriggerType, payload?: { agent?: AgentName, instruction?: string, from?: string }) => void
  onMessage: (from: string, text: string) => void
  /** Apply a user-approved edit proposal (runs agent-actions with direct path) */
  applyApprovedEdit: (agent: AgentName, payload: EditProposalPayload) => void
  destroy: () => void
}

function log(...args: unknown[]) {
  if (import.meta.env.DEV) console.log('[orch]', ...args)
}

/** Build instruction for an agent reacting to another agent's doc edit */
function buildReactionInstruction(editingAgent: string, actionDesc: string, actionType: string, reactingPersona: string): string {
  const specialtyHint = reactingPersona ? reactingPersona.slice(0, 80) : ''
  return [
    `${editingAgent} just edited the doc: ${actionDesc}.`,
    actionType === 'insert' ? `They added new content. Evaluate it from your perspective${specialtyHint ? ` (${specialtyHint})` : ''}.` : '',
    actionType === 'replace' ? `They rewrote existing text. Check if the replacement is better or lost important nuance.` : '',
    `Options: build on it with your expertise, challenge a specific claim, add a missing angle, or ask a pointed question. If you fully agree and have nothing to add, just acknowledge briefly and yield.`,
  ].filter(Boolean).join(' ')
}

function approvedPayloadToAction(agent: string, payload: EditProposalPayload): AgentAction {
  if (payload.kind === 'insert') {
    return {
      type: 'insert',
      position: payload.target && payload.target.trim() ? payload.target : 'end',
      content: payload.afterText,
      chatBefore: `${agent}: approved proposal`,
      chatMessage: 'Applied approved addition.',
    }
  }
  if (payload.kind === 'replace') {
    return {
      type: 'replace',
      searchText: payload.beforeText || '',
      replaceWith: payload.afterText,
      chatBefore: `${agent}: approved proposal`,
      chatMessage: 'Applied approved replacement.',
    }
  }
  return {
    type: 'delete',
    deleteText: payload.beforeText || '',
    chatBefore: `${agent}: approved proposal`,
    chatMessage: 'Applied approved deletion.',
  }
}

export function createOrchestrator(config: OrchestratorConfig): OrchestratorHandle {
  const turnQueue = createTurnQueue({ agents: config.agents })
  let destroyed = false
  const editorLockRef: { current: string | null } = { current: null }
  const typingTimers: Record<string, number> = {}
  const pendingInstructions: Record<string, { trigger: AskParams['trigger'], instruction: string }> = {}
  let lastActionDescription: Record<string, string> = {}
  const agentNames = config.agents.map(a => a.name)
  function getAgentConfig(name: string) { return config.agents.find(a => a.name === name) }

  // Merge experiment settings with defaults
  const experiments = { ...DEFAULT_EXPERIMENTS, ...config.experiments }

  // Merge limits: config.limits (from tests/code) take precedence, then experiment overrides
  const baseLimits = {
    ...DEFAULT_LIMITS,
    // Experiment settings override defaults but config.limits overrides experiments
    maxTurns: config.limits?.maxTurns ?? experiments.maxTurns,
    maxExchanges: config.limits?.maxExchanges ?? experiments.maxExchanges,
    heartbeatDelayMs: config.limits?.heartbeatDelayMs ?? experiments.heartbeatDelayMs,
    reactionDelayMs: config.limits?.reactionDelayMs ?? experiments.reactionDelayMs,
    maxConsecutiveFailures: config.limits?.maxConsecutiveFailures ?? DEFAULT_LIMITS.maxConsecutiveFailures,
  }
  const limits = config.demoMode
    ? { ...baseLimits, maxTurns: Math.max(baseLimits.maxTurns, 6), maxExchanges: Math.max(baseLimits.maxExchanges, 6) }
    : baseLimits

  function vlog(...args: unknown[]) {
    if (experiments.verboseLogging) console.log('[orch:verbose]', ...args)
  }

  // Track pending doc-edit reaction to prevent double-triggers
  let pendingReaction: AgentName | null = null
  // Round-robin index for balanced agent selection
  let reactionRoundRobin = 0
  // Track consecutive failures per agent
  const consecutiveFailures: Record<string, number> = Object.fromEntries(config.agents.map(a => [a.name, 0]))
  const pausedAgents = new Set<AgentName>()
  // Track ALL scheduled timeouts so we can clear them on destroy/user-message
  const scheduledTimers = new Set<number>()
  // Heartbeat timer for proactive agent behaviors
  let heartbeatTimer: number | null = null
  // Session phase managed by phase-machine reducer
  let phaseState: PhaseState = { ...initialPhaseState }
  // Doc state classification cached on doc-opened
  let currentDocState: DocState = 'blank'

  function dispatchPhase(action: Parameters<typeof phaseReducer>[1]) {
    const next = phaseReducer(phaseState, action)
    if (next !== phaseState) {
      phaseState = next
      config.onPhaseChange?.(phaseState)
    }
  }

  function scheduleTimeout(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      scheduledTimers.delete(id)
      if (!destroyed) fn()
    }, ms)
    scheduledTimers.add(id)
    return id
  }

  function clearAllTimers() {
    scheduledTimers.forEach(id => clearTimeout(id))
    scheduledTimers.clear()
    Object.keys(typingTimers).forEach(k => {
      clearTimeout(typingTimers[k])
      delete typingTimers[k]
    })
    stopHeartbeat()
  }

  function enqueue(req: TurnRequest) {
    if (destroyed) return
    if (pausedAgents.has(req.agent)) {
      log('enqueue skipped — agent paused due to errors:', req.agent)
      return
    }
    log('enqueue', req.agent, req.trigger, req.instruction?.slice(0, 40))
    vlog('enqueue detail', { agent: req.agent, trigger: req.trigger, queueBefore: turnQueue.size(), processing: turnQueue.isProcessing() })
    const depth = turnQueue.push(req)
    const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
    const sessionId = sessionMatch?.[1] || ''
    events.orchestratorQueueDepth(sessionId, depth, turnQueue.isProcessing() ? 'processing' : null)
    processQueue()
  }

  async function processQueue() {
    if (turnQueue.isProcessing() || turnQueue.size() === 0 || destroyed) return
    turnQueue.setProcessing(true)

    const req = turnQueue.shift()!
    const turnStartTime = Date.now()
    log('processing', req.agent, req.trigger, 'queue:', turnQueue.size())
    const editor = config.getEditor()
    if (!editor) {
      log('no editor, skipping')
      turnQueue.setProcessing(false)
      return
    }

    config.onAgentState(req.agent, 'thinking', 'Thinking...')

    try {
      const agentCfg = getAgentConfig(req.agent)
      const otherNames = agentNames.filter(n => n !== req.agent)
      const otherAgent = otherNames[0] || req.agent
      const docText = config.getDocText()
      const agentMode = getAgentMode(req.agent, phaseState.current)

      let action: AgentAction
      if (req.directAction) {
        action = verifyAndNormalizeAction({ ...req.directAction }, { allowDirectDocEdit: true })
      } else {
        const raw = await askAgent({
          agentName: req.agent,
          ownerName: agentCfg?.owner || 'You',
          docText,
          chatHistory: config.getMessages().slice(-10),
          trigger: req.trigger,
          instruction: req.instruction,
          recentChange: lastActionDescription[otherAgent],
          otherAgentLastAction: lastActionDescription[otherAgent],
          lockHolder: editorLockRef.current,
          persona: agentCfg?.persona || '',
          otherAgents: agentNames,
          sessionTemplate: config.sessionTemplate,
          docStructure: extractDocStructure(docText),
          phase: phaseState.current,
          docState: currentDocState,
          agentMode,
          tasks: config.getTasks?.(),
        })
        // Allow direct doc edits for initial (doc-opened) turns and autonomous turns
        // Only use propose_edit review flow for user-message responses
        const directEdit = req.isInitial || req.trigger === 'autonomous' || req.trigger === 'instruction'
        action = verifyAndNormalizeAction(raw, { allowDirectDocEdit: directEdit })
      }

      // Phase safety net: if the LLM returns an action not allowed in the current phase,
      // downgrade it to chat (skip for user-approved apply path)
      if (!req.directAction && !isActionAllowed(phaseState.current, action.type)) {
        log(`phase ${phaseState.current}: blocked action`, action.type, '-> downgrading to chat')
        action.type = 'chat'
        action.chatMessage = action.chatBefore || action.chatMessage || action.content?.slice(0, 120) || 'Let me know what direction you want to take this.'
        // Clear doc-edit fields
        delete action.content
        delete action.searchText
        delete action.replaceWith
        delete action.deleteText
        delete action.newTitle
        delete action.position
        delete action.editKind
        delete action.editTarget
        delete action.beforeText
        delete action.afterText
        delete action.editRationale
        delete action.sources
      }

      // Emit reasoning before executing action
      if (action.reasoning && action.reasoning.length > 0) {
        config.onAgentReasoning?.(req.agent, action.reasoning)
      }

      if (action.type === 'propose_edit' && action.editKind) {
        const payload: EditProposalPayload = {
          kind: action.editKind,
          target: action.editTarget,
          beforeText: action.beforeText,
          afterText: action.afterText ?? '',
          rationale: action.editRationale,
          sources: action.sources,
        }
        config.onProposedEdit?.(req.agent, payload)
        config.onAgentState(req.agent, 'idle')
        consecutiveFailures[req.agent] = 0
        const actionDesc = describeAction(req.agent, action)
        lastActionDescription[req.agent] = actionDesc
        turnQueue.incrementTurnCount(req.agent)
        if (pendingReaction === req.agent) pendingReaction = null
        turnQueue.setProcessing(false)
        const pending = pendingInstructions[req.agent]
        if (pending) {
          delete pendingInstructions[req.agent]
          if (pending.instruction !== req.instruction) {
            enqueue({ agent: req.agent, trigger: pending.trigger, instruction: pending.instruction })
            return
          }
        }
        if (action.shouldContinue && !turnQueue.isTurnLimitReached(req.agent, limits.maxTurns)) {
          enqueue({ agent: req.agent, trigger: 'autonomous' })
        } else {
          processQueue()
        }
        return
      }

      // Handle task actions (propose/complete/update)
      if (action.type === 'task' && action.taskAction && config.onTaskAction) {
        config.onTaskAction(req.agent, action.taskAction as TaskActionPayload)
        // Task actions may also have a chat message
        if (action.chatMessage) {
          config.onChatMessage(req.agent, action.chatMessage)
        }
        config.onAgentState(req.agent, 'idle')
        consecutiveFailures[req.agent] = 0
        turnQueue.incrementTurnCount(req.agent)
        if (pendingReaction === req.agent) pendingReaction = null
        turnQueue.setProcessing(false)
        processQueue()
        return
      }

      const callbacks: ActionCallbacks = {
        onStateChange: (status, thought) => {
          if (!destroyed) config.onAgentState(req.agent, status, thought)
        },
        onChatMessage: (from, text) => {
          if (!destroyed) config.onChatMessage(from, text)
        },
        onDone: (success?: boolean) => {
          if (destroyed) { turnQueue.setProcessing(false); return }
          consecutiveFailures[req.agent] = 0
          log('done', req.agent, action.type, 'success:', success, 'shouldContinue:', action.shouldContinue)
          const durationMs = Date.now() - turnStartTime
          const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
          const sessionId = sessionMatch?.[1] || ''
          events.orchestratorTurn(sessionId, req.agent, req.trigger, action.type, success !== false, durationMs)
          const actionDesc = describeAction(req.agent, action)
          lastActionDescription[req.agent] = actionDesc
          turnQueue.incrementTurnCount(req.agent)
          // Handle rename action
          if (action.type === 'rename' && action.newTitle && config.onRenameSession) {
            config.onRenameSession(action.newTitle)
          }
          // Handle proposal action
          if (action.type === 'propose' && action.proposalType && config.onProposal) {
            config.onProposal(req.agent, action.proposalType, action.proposal || '')
          }
          // Fire timeline callback for doc edits
          const didDocEdit = action.type === 'insert' || action.type === 'replace' || action.type === 'read' || action.type === 'image'
          if (didDocEdit) {
            config.onDocAction?.(req.agent, actionDesc)
          }
          if (pendingReaction === req.agent) pendingReaction = null
          turnQueue.setProcessing(false)

          // Process queued instruction — but skip if it's the same one we just ran
          const pending = pendingInstructions[req.agent]
          if (pending) {
            delete pendingInstructions[req.agent]
            if (pending.instruction !== req.instruction) {
              enqueue({ agent: req.agent, trigger: pending.trigger, instruction: pending.instruction })
              return
            }
          }

          // After a SUCCESSFUL doc edit, prompt the OTHER agent to react
          const didEdit = (action.type === 'insert' || action.type === 'replace' || action.type === 'image') && success !== false
          if (didEdit && turnQueue.size() === 0) {
            // Round-robin routing: rotate through other agents for balanced participation
            const otherNames = agentNames.filter(n => n !== req.agent)
            const other: AgentName = otherNames[reactionRoundRobin % otherNames.length] || agentNames[0]
            reactionRoundRobin++
            // Initial (welcome/doc-opened) reactions don't count toward the exchange limit
            const countsAsExchange = !req.isInitial
            if (other !== req.agent && (countsAsExchange ? !turnQueue.isExchangeLimitReached(limits.maxExchanges) : true) && !turnQueue.isTurnLimitReached(other, limits.maxTurns) && pendingReaction !== other) {
              if (countsAsExchange) turnQueue.incrementExchange()
              pendingReaction = other
              const otherCfg = getAgentConfig(other)
              const reactionInstruction = buildReactionInstruction(req.agent, actionDesc, action.type, otherCfg?.persona || '')
              scheduleTimeout(() => {
                enqueue({
                  agent: other,
                  trigger: 'instruction',
                  instruction: reactionInstruction,
                  isInitial: req.isInitial,
                })
              }, limits.reactionDelayMs[0] + Math.random() * (limits.reactionDelayMs[1] - limits.reactionDelayMs[0]))
            }
          } else if (action.shouldContinue && !turnQueue.isTurnLimitReached(req.agent, limits.maxTurns)) {
            enqueue({ agent: req.agent, trigger: 'autonomous' })
          } else {
            processQueue()
          }
        },
      }

      vlog('executing', req.agent, action.type, action.position || '')
      executeAgentAction(editor, req.agent, agentCfg?.color || '#1a1a1a', action, editorLockRef, typingTimers, callbacks, experiments.insertStrategy)
    } catch (err) {
      if (destroyed) { turnQueue.setProcessing(false); return }
      log('error', req.agent, err)
      consecutiveFailures[req.agent]++
      const failures = consecutiveFailures[req.agent]

      const agentError = err instanceof AgentError
        ? err
        : new AgentError(
            err instanceof Error ? err.message : String(err),
            'network_error',
          )

      config.onError?.(req.agent, agentError, failures)

      if (failures >= limits.maxConsecutiveFailures) {
        log(`pausing ${req.agent} after ${failures} consecutive failures`)
        pausedAgents.add(req.agent)
        turnQueue.removeAgent(req.agent)
      }

      config.onAgentState(req.agent, 'idle')
      turnQueue.setProcessing(false)
      processQueue()
    }
  }

  function describeAction(agent: string, action: AgentAction): string {
    switch (action.type) {
      case 'insert': return `${agent} inserted: "${(action.content || '').slice(0, 120)}"`
      case 'replace': return `${agent} replaced: "${(action.searchText || '').slice(0, 60)}"`
      case 'read': return `${agent} read: "${(action.highlightText || '').slice(0, 80)}"`
      case 'chat': return `${agent} sent a message`
      case 'search': return `${agent} searched: "${(action.query || '').slice(0, 80)}"`
      case 'rename': return `${agent} renamed doc to "${action.newTitle || ''}"`
      case 'delete': return `${agent} deleted: "${(action.deleteText || '').slice(0, 60)}"`
      case 'propose': return `${agent} proposed: ${(action.proposal || '').slice(0, 80)}`
      case 'plan': return `${agent} outlined a plan with ${action.steps?.length || 0} steps`
      case 'ask': return `${agent} asked: "${(action.question || '').slice(0, 80)}"`
      case 'image': return `${agent} generated an image: "${(action.imageCaption || action.imagePrompt || '').slice(0, 80)}"`
      case 'propose_edit': {
        const k = action.editKind || 'edit'
        return `${agent} proposed ${k}: "${(action.afterText || action.beforeText || '').slice(0, 80)}"`
      }
      default: return `${agent} acted`
    }
  }

  function trigger(type: TriggerType, payload?: { agent?: AgentName, instruction?: string, from?: string }) {
    if (destroyed) return

    switch (type) {
      case 'doc-opened': {
        turnQueue.resetTurnCounts()
        turnQueue.resetExchangeCount()
        pendingReaction = null

        // Classify doc state and decide session phase
        const docText = config.getDocText()
        const template = config.sessionTemplate as import('./types').DocTemplate | undefined
        currentDocState = classifyDocState(docText, template)
        log('doc-opened', 'docState:', currentDocState, 'template:', template)

        if (currentDocState === 'content') {
          // Existing content: skip to drafting phase
          dispatchPhase({ type: 'jump-to', phase: 'drafting' })
          startHeartbeat()
          config.agents.forEach((a, i) => {
            scheduleTimeout(() => enqueue({
              agent: a.name,
              trigger: 'instruction',
              instruction: `Review the doc and contribute from your area of expertise. Use your background in: ${a.persona.slice(0, 100)}`,
              isInitial: true,
            }), config.demoMode ? 1500 + i * 2500 : 2500 + i * 3500)
          })
        } else if (currentDocState === 'blank') {
          // Blank doc: agents introduce themselves in chat, wait for user direction
          dispatchPhase({ type: 'jump-to', phase: 'drafting' })
          const lead = config.agents[0]
          if (lead) {
            scheduleTimeout(() => enqueue({
              agent: lead.name,
              trigger: 'instruction',
              instruction: `The document is blank. Introduce yourself briefly in chat (1 sentence about your expertise). Then ask the user what they'd like to work on. Do NOT write anything in the document. Use "chat" action only.`,
              isInitial: true,
            }), config.demoMode ? 1500 : 3000)
          }
          startHeartbeat()
        } else {
          // Template or sparse: agents can contribute to existing structure
          dispatchPhase({ type: 'jump-to', phase: 'drafting' })
          const lead = config.agents[0]
          if (lead) {
            const instruction = currentDocState === 'template'
              ? `A ${template || 'document'} template is loaded. Pick the most important section and start drafting real content for it. Briefly mention in chat what you're writing and why.`
              : `The doc has some early content. Build on what's already here — expand the strongest section with concrete details from your expertise. Mention what you're adding in chat.`
            scheduleTimeout(() => enqueue({
              agent: lead.name,
              trigger: 'instruction',
              instruction,
              isInitial: true,
            }), config.demoMode ? 1500 : 3000)
          }
          startHeartbeat()
        }
        break
      }

      case 'user-message': {
        const instruction = payload?.instruction || ''
        const lower = instruction.toLowerCase()

        // Any user message during discovery/planning jumps to drafting
        if (phaseState.current === 'discovery' || phaseState.current === 'planning') {
          dispatchPhase({ type: 'jump-to', phase: 'drafting' })
          log(`phase transition: ${phaseState.current} -> drafting (user message)`)
        }
        const mentionedAgents = agentNames.filter(n => lower.includes(n.toLowerCase()) || lower.includes('@' + n.toLowerCase()))
        const mentionsBoth = mentionedAgents.length === 0

        // User messages take priority — clear everything
        turnQueue.clear()
        for (const name of agentNames) delete pendingInstructions[name]
        // Cancel all pending reaction timeouts
        scheduledTimers.forEach(id => clearTimeout(id))
        scheduledTimers.clear()
        turnQueue.resetExchangeCount()
        pendingReaction = null
        // Unpause agents on user interaction so they can retry
        pausedAgents.clear()
        for (const name of agentNames) consecutiveFailures[name] = 0

        const agentsToTrigger = mentionsBoth ? agentNames : mentionedAgents
        for (const name of agentsToTrigger) {
          if (turnQueue.isProcessing()) {
            pendingInstructions[name] = { trigger: 'instruction', instruction }
          } else {
            enqueue({ agent: name, trigger: 'instruction', instruction })
          }
        }
        startHeartbeat()
        break
      }

      case 'agent-tagged': {
        const target = payload?.agent
        const from = payload?.from || 'someone'
        if (target && pendingReaction === target) {
          log('agent-tagged skipped — already has pending reaction', target)
          break
        }
        if (turnQueue.isExchangeLimitReached(limits.maxExchanges)) {
          log('exchange limit reached, ignoring agent tag')
          break
        }
        if (target && !turnQueue.isTurnLimitReached(target, limits.maxTurns)) {
          turnQueue.incrementExchange()
          enqueue({ agent: target, trigger: 'instruction', instruction: `${from} just mentioned you in chat. Read the recent chat and respond to their latest message.` })
        }
        break
      }

      case 'turn-complete':
        break
    }
  }

  function onMessage(from: string, text: string) {
    if (agentNames.includes(from)) {
      const lower = text.toLowerCase()
      for (const other of agentNames) {
        if (other !== from && lower.includes('@' + other.toLowerCase())) {
          scheduleTimeout(() => {
            trigger('agent-tagged', { agent: other, from })
          }, 2000 + Math.random() * 2000)
        }
      }
    }
  }

  function startHeartbeat() {
    stopHeartbeat()
    const [hbMin, hbMax] = limits.heartbeatDelayMs
    const delay = config.demoMode ? 8000 + Math.random() * 4000 : hbMin + Math.random() * (hbMax - hbMin)
    heartbeatTimer = scheduleTimeout(() => {
      heartbeatTimer = null
      fireHeartbeat()
    }, delay)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer)
      scheduledTimers.delete(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  async function fireHeartbeat() {
    if (destroyed || agentNames.length === 0) return
    if (turnQueue.isProcessing()) {
      startHeartbeat()
      return
    }

    const docText = config.getDocText()
    const recentMessages = config.getMessages().slice(-10)
    const availableAgents = config.agents.filter(agent =>
      !pausedAgents.has(agent.name) && !turnQueue.hasAgent(agent.name)
    )

    const scriptedObservation = detectObservations(
      docText,
      recentMessages,
      agentNames,
      phaseState.current,
    ).find(obs => availableAgents.some(agent => agent.name === obs.agent))

    if (scriptedObservation) {
      scheduleTimeout(() => {
        if (!destroyed && !pausedAgents.has(scriptedObservation.agent)) {
          config.onChatMessage(scriptedObservation.agent, scriptedObservation.text)
        }
      }, scriptedObservation.delay)
      startHeartbeat()
      return
    }

    if (availableAgents.length === 0) {
      startHeartbeat()
      return
    }

    const agent = availableAgents[Math.floor(Math.random() * availableAgents.length)]

    try {
      const observation = await generateObservation(
        docText,
        recentMessages,
        agent.name,
        agent.persona,
        agentNames.filter(n => n !== agent.name),
      )

      if (observation && !destroyed) {
        config.onChatMessage(agent.name, observation)
      }
    } catch (err) {
      log('heartbeat error:', err)
    }

    // Restart heartbeat timer
    if (!destroyed) startHeartbeat()
  }

  function applyApprovedEdit(agent: AgentName, payload: EditProposalPayload) {
    if (destroyed) return
    enqueue({ agent, trigger: 'instruction', instruction: '', directAction: approvedPayloadToAction(agent, payload) })
  }

  function destroy() {
    destroyed = true
    clearAllTimers()
    resetRateLimiter()
    resetHeartbeat()
    resetWizard()
    turnQueue.reset()
    editorLockRef.current = null
    for (const name of agentNames) {
      consecutiveFailures[name] = 0
      delete pendingInstructions[name]
    }
    lastActionDescription = {}
    pendingReaction = null
    reactionRoundRobin = 0
    pausedAgents.clear()
    phaseState = { ...initialPhaseState }
    currentDocState = 'blank'
  }

  return { trigger, onMessage, applyApprovedEdit, destroy }
}
