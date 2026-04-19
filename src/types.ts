export type DocTemplate = 'blank' | 'prd' | 'tech-spec' | 'meeting-notes' | 'demo-prd'

export interface Session {
  id: string
  user_id: string | null
  title: string
  template: DocTemplate
  created_at: string
  updated_at: string
}

export interface AgentPersonaRecord {
  id: string
  session_id: string
  name: string
  description: string
  system_prompt: string
  color: string
  owner: string
  model: string
  sort_order: number
}

/**
 * An append-only entry in the per-session decision ledger. See
 * docs/brainstorms/2026-04-19-multi-entity-collab-design-lenses.md
 * (lens 2, "A decision ledger"). Kept intentionally loose — the
 * `entry` payload is a JSON record while the UI and affordances
 * stabilize. The authoritative proposer lives on
 * `DecisionRecord.proposed_by`, not here, so there's a single source
 * of truth.
 */
export interface DecisionEntry {
  objector?: string
  adopter?: string
  alternative?: string
  confidence?: number
  rationale?: string
}

export interface DecisionRecord {
  id: string
  session_id: string
  /** Heading or span identifier the decision attaches to. Nullable to
   *  match the Supabase row shape (not optional). */
  paragraph_anchor: string | null
  entry: DecisionEntry
  /** Authoritative proposer — human username or agent name. */
  proposed_by: string
  created_at: string
}

export interface ChatMessageRecord {
  id: string
  session_id: string
  sender: string
  text: string
  reasoning?: string[]
  created_at: string
}

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

export interface OrchestratorLimits {
  maxTurns: number
  maxExchanges: number
  maxConsecutiveFailures: number
  heartbeatDelayMs: [number, number]
  reactionDelayMs: [number, number]
}

export const DEFAULT_LIMITS: OrchestratorLimits = {
  maxTurns: 2,
  maxExchanges: 2,
  maxConsecutiveFailures: 3,
  heartbeatDelayMs: [20000, 30000],
  reactionDelayMs: [3000, 5000],
}

/**
 * Team volume dial — a shared per-doc setting that determines how
 * loudly the active agents participate. See
 * docs/brainstorms/2026-04-19-multi-entity-collab-design-lenses.md
 * (designer lens, #5 "Team volume dial").
 *
 *   silent   — agents only respond when @-mentioned
 *   whisper  — margin suggestions only, no chat
 *   discuss  — chat + suggestions, no direct edits
 *   active   — agents edit freely in unclaimed regions
 *
 * Shipping the alphabet + default first so a follow-up can wire it to
 * a header dial or settings without revisiting the naming.
 */
export type TeamVolume = 'silent' | 'whisper' | 'discuss' | 'active'
export const DEFAULT_TEAM_VOLUME: TeamVolume = 'discuss'
export const TEAM_VOLUME_LABELS: Record<TeamVolume, string> = {
  silent: 'Silent',
  whisper: 'Whisper',
  discuss: 'Discuss',
  active: 'Active',
}

export interface ExperimentSettings {
  autoActivateOnAdd: boolean
  insertStrategy: 'strict' | 'fuzzy' | 'always-end'
  reactionDelayMs: [number, number]
  heartbeatDelayMs: [number, number]
  maxTurns: number
  maxExchanges: number
  verboseLogging: boolean
  defaultAgentNames: string[]
}

export const DEFAULT_EXPERIMENTS: ExperimentSettings = {
  autoActivateOnAdd: true,
  insertStrategy: 'fuzzy',
  reactionDelayMs: [3000, 5000],
  heartbeatDelayMs: [20000, 30000],
  maxTurns: 2,
  maxExchanges: 2,
  verboseLogging: false,
  defaultAgentNames: ['Aiden', 'Nova'],
}

// Shared agent config used across orchestrator, configurator, and UI
export interface AgentConfig {
  name: string
  persona: string
  owner: string
  color: string
  description?: string
}

// Chat message as rendered in the UI
export interface DocChange {
  type: 'insert' | 'replace' | 'delete'
  summary: string
  added?: string
  removed?: string
}

/** Pending doc edit shown in chat; applied only after user approves */
export interface EditProposalPayload {
  kind: 'insert' | 'replace' | 'delete'
  /** Section anchor, e.g. after:Architecture or end */
  target?: string
  beforeText?: string
  afterText: string
  rationale?: string
  sources?: { url: string, title?: string, quote?: string }[]
}

export type Proposal =
  | {
      type: 'create-doc' | 'delete-doc' | 'add-agent' | 'remove-agent'
      description: string
      status: 'pending' | 'approved' | 'rejected'
    }
  | {
      type: 'edit'
      edit: EditProposalPayload
      status: 'pending' | 'approved' | 'rejected'
    }

export interface Message {
  id: string
  from: string
  text: string
  time: string
  showDocButton?: boolean
  reasoning?: string[]
  docChange?: DocChange
  proposal?: Proposal
  taskEvent?: TaskEvent
}

export type TaskEvent =
  | { type: 'proposed'; task: Pick<AgentTask, 'title' | 'assignedAgents' | 'sectionAnchor'>; rationale?: string }
  | { type: 'extracted'; task: Pick<AgentTask, 'title' | 'assignedAgents'> }
  | { type: 'completed'; taskId: string; title: string }
  | { type: 'plan'; tasks: Pick<AgentTask, 'title' | 'assignedAgents' | 'order'>[] }

export interface AgentState {
  status: 'idle' | 'thinking' | 'typing' | 'reading' | 'editing'
  thought?: string
  inDoc: boolean
}

export interface TimelineEntry {
  id: string
  color: string
  tooltip: string
}

// Agent task system
export type TaskStatus = 'pending' | 'active' | 'complete' | 'dismissed'

export interface AgentTask {
  id: string
  sessionId: string
  title: string
  status: TaskStatus
  assignedAgents: string[]
  createdBy: string            // 'user' or agent name
  sectionAnchor?: string       // heading this task maps to
  order: number
  completedBy?: string
  createdAt: string
  completedAt?: string
}

export interface TaskActionPayload {
  type: 'propose' | 'complete' | 'update'
  taskId?: string
  title?: string
  rationale?: string
  assignedAgents?: string[]
  sectionAnchor?: string
}
