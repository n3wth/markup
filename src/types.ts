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

export interface ExperimentSettings {
  autoActivateOnAdd: boolean
  insertStrategy: 'strict' | 'fuzzy' | 'always-end'
  reactionDelayMs: [number, number]
  heartbeatDelayMs: [number, number]
  maxTurns: number
  maxExchanges: number
  verboseLogging: boolean
}

export const DEFAULT_EXPERIMENTS: ExperimentSettings = {
  autoActivateOnAdd: true,
  insertStrategy: 'fuzzy',
  reactionDelayMs: [3000, 5000],
  heartbeatDelayMs: [20000, 30000],
  maxTurns: 2,
  maxExchanges: 2,
  verboseLogging: false,
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
}

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
