import { useEffect, useRef, useState } from 'react'
import type { AgentState, AgentTask, Message, Session } from '../types'

/**
 * The piece of App-level state that every collaboration surface reads: the
 * currently-open session, the chat stream, the task list, and each agent's
 * live status. Owned by {@link useSessionState} so hooks like
 * {@link useMarkupEditor} can receive the refs/setters directly without
 * going through a mutable callback bag.
 */
export interface UseSessionStateResult {
  /** Current session, or null if the user is on the home dashboard. */
  activeSession: Session | null
  /** React setter for {@link activeSession}. Stable identity. */
  setActiveSession: React.Dispatch<React.SetStateAction<Session | null>>
  /**
   * Mirror ref of {@link activeSession} for async/debounced callers that
   * cannot close over the latest value. Kept in sync on every render.
   */
  activeSessionRef: React.MutableRefObject<Session | null>

  /** Chat + system timeline entries for the active session. */
  messages: Message[]
  /** React setter for {@link messages}. Stable identity. */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  /** Mirror ref of {@link messages}, written each render. */
  messagesRef: React.MutableRefObject<Message[]>

  /** Agent-authored tasks for the active session. */
  tasks: AgentTask[]
  /** React setter for {@link tasks}. Stable identity. */
  setTasks: React.Dispatch<React.SetStateAction<AgentTask[]>>
  /** Mirror ref of {@link tasks}, written each render. */
  tasksRef: React.MutableRefObject<AgentTask[]>

  /** Per-agent status bag (idle/reading/thinking/...) keyed by agent name. */
  agentStates: Record<string, AgentState>
  /** React setter for {@link agentStates}. Stable identity. */
  setAgentStates: React.Dispatch<React.SetStateAction<Record<string, AgentState>>>
}

/**
 * Owns the session-scoped state that used to live inline in App.tsx:
 * `activeSession`, `messages`, `tasks`, `agentStates`. Each piece of state
 * is paired with a `.current`-mirror ref so async callers (save debounce,
 * orchestrator callbacks, keyboard shortcuts) can read the latest value
 * without the stale-closure hazard.
 *
 * The hook is intentionally state-only — it does not own any side effects,
 * hydration, or persistence. Those concerns live in {@link useSession} and
 * {@link useOrchestratorWiring} (W0-T010), which consume this hook's setters
 * and refs via their options.
 *
 * Splitting state from flows lets {@link useMarkupEditor} receive
 * `activeSessionRef` and `setActiveSession` as plain options rather than
 * through a mutable callback bag, eliminating the W0-T008 `callbacksRef`
 * bridge.
 */
export function useSessionState(): UseSessionStateResult {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const activeSessionRef = useRef<Session | null>(null)
  useEffect(() => { activeSessionRef.current = activeSession })

  const [messages, setMessages] = useState<Message[]>([])
  const messagesRef = useRef<Message[]>(messages)
  useEffect(() => { messagesRef.current = messages })

  const [tasks, setTasks] = useState<AgentTask[]>([])
  const tasksRef = useRef<AgentTask[]>(tasks)
  useEffect(() => { tasksRef.current = tasks })

  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({})

  return {
    activeSession,
    setActiveSession,
    activeSessionRef,
    messages,
    setMessages,
    messagesRef,
    tasks,
    setTasks,
    tasksRef,
    agentStates,
    setAgentStates,
  }
}
