export class AgentError extends Error {
  readonly code: 'rate_limit' | 'api_error' | 'parse_error' | 'network_error'
  readonly status: number | undefined
  readonly retryable: boolean

  constructor(
    message: string,
    code: 'rate_limit' | 'api_error' | 'parse_error' | 'network_error',
    status?: number,
    retryable = false,
  ) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

import { getStoredApiKey } from './AgentConfigurator'

// All API calls go through the server-side proxy which uses the Vercel AI SDK.
const API_URL = '/api/gemini'

// Client-side rate limiter: enforces minimum spacing between calls to stay within free tier limits.
// The server handles retries for transient errors via AI SDK's maxRetries.
// This limiter prevents the client from overwhelming the server with concurrent requests.
const rateLimiter = {
  lastCallTime: 0,
  minIntervalMs: 7000,  // min 7s between calls (~8 RPM, safe under 10 RPM free tier)
  backoffUntil: 0,
  consecutiveErrors: 0,
  maxRetries: 3,
  pendingTimers: new Set<ReturnType<typeof setTimeout>>(),
  disposed: false,

  async waitForSlot(): Promise<boolean> {
    if (this.disposed) return false

    // If we're in backoff, check if it's expired
    if (Date.now() < this.backoffUntil) {
      const wait = this.backoffUntil - Date.now()
      console.log(`[rate] backing off for ${Math.round(wait / 1000)}s`)
      await new Promise<void>((resolve) => {
        const id = setTimeout(() => { this.pendingTimers.delete(id); resolve() }, wait)
        this.pendingTimers.add(id)
      })
    }

    if (this.disposed) return false

    // Enforce minimum interval between calls
    const elapsed = Date.now() - this.lastCallTime
    if (elapsed < this.minIntervalMs) {
      await new Promise<void>((resolve) => {
        const id = setTimeout(() => { this.pendingTimers.delete(id); resolve() }, this.minIntervalMs - elapsed)
        this.pendingTimers.add(id)
      })
    }

    if (this.disposed) return false

    this.lastCallTime = Date.now()
    return true
  },

  onSuccess() {
    this.consecutiveErrors = 0
  },

  onRateLimit() {
    this.consecutiveErrors++
    const backoffSec = Math.min(60, 5 * Math.pow(2, this.consecutiveErrors - 1))
    this.backoffUntil = Date.now() + backoffSec * 1000
    console.warn(`[rate] 429 hit, backing off ${backoffSec}s (attempt ${this.consecutiveErrors})`)
  },

  onError() {
    this.consecutiveErrors++
    if (this.consecutiveErrors >= this.maxRetries) {
      this.backoffUntil = Date.now() + 30000
      console.warn('[rate] too many errors, cooling down 30s')
    }
  },

  shouldRetry(): boolean {
    return this.consecutiveErrors < this.maxRetries && !this.disposed
  },

  dispose() {
    this.disposed = true
    this.pendingTimers.forEach(id => clearTimeout(id))
    this.pendingTimers.clear()
  },

  reset() {
    this.pendingTimers.forEach(id => clearTimeout(id))
    this.pendingTimers.clear()
    this.disposed = false
    this.consecutiveErrors = 0
    this.backoffUntil = 0
    this.lastCallTime = 0
  },
}

export type AgentActionType = 'insert' | 'replace' | 'read' | 'chat' | 'search' | 'rename' | 'delete' | 'propose' | 'plan' | 'ask' | 'image' | 'propose_edit'

export interface AgentAction {
  type: AgentActionType
  position?: string
  content?: string
  searchText?: string
  replaceWith?: string
  highlightText?: string
  query?: string
  newTitle?: string
  deleteText?: string
  proposal?: string
  proposalType?: 'create-doc' | 'delete-doc' | 'add-agent' | 'remove-agent'
  steps?: string[]
  question?: string
  imagePrompt?: string
  imageCaption?: string
  chatBefore?: string
  chatMessage?: string
  thought?: string
  reasoning?: string[]
  shouldContinue?: boolean
  /** propose_edit: insert | replace | delete */
  editKind?: 'insert' | 'replace' | 'delete'
  /** Section anchor e.g. after:Heading or end */
  editTarget?: string
  beforeText?: string
  afterText?: string
  editRationale?: string
  sources?: { url: string, title?: string, quote?: string }[]
}

import type { SessionPhase } from './phase-machine'
import type { AgentMode } from './agent-modes'

export type { SessionPhase }

export interface AskParams {
  agentName: string
  ownerName: string
  docText: string
  chatHistory: { from: string, text: string }[]
  trigger: 'autonomous' | 'instruction' | 'inline-doc'
  instruction?: string
  recentChange?: string
  otherAgentLastAction?: string
  lockHolder?: string | null
  persona: string
  otherAgents: string[]
  sessionTemplate?: string
  docStructure?: DocStructure
  phase?: SessionPhase
  docState?: 'blank' | 'template' | 'sparse' | 'content'
  agentMode?: AgentMode
}

// Default personas kept for backward compatibility
export const DEFAULT_PERSONAS: Record<string, string> = {
  Aiden: `You are Aiden, a collaborative AI agent who writes with technical precision. You think in systems, APIs, data models, and implementation trade-offs. You add concrete substance to documents: specific protocols, data flows, component boundaries, failure modes, and performance constraints. You turn vague ideas into buildable specifications. When you see hand-waving, you replace it with numbers, diagrams, or interface contracts. Your writing is tight — every sentence carries information.`,
  Nova: `You are Nova, a collaborative AI agent who writes from the user's perspective. You think in user journeys, adoption curves, market positioning, and behavioral psychology. You challenge assumptions by asking "who benefits?" and "what breaks?". You add user scenarios, edge cases, adoption risks, and competitive framing to documents. When you see a technical spec without a user story, you write one. Your writing is clear and direct — you make the case, then stop.`,
}

function truncateDoc(text: string, maxChars = 2000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n[...truncated]'
}

export interface DocStructure {
  headings: string[]
  wordCounts: Record<string, number>
  totalWords: number
  avgSectionWords: number
  thinSections: string[]
  emptySections: string[]
  headingLevels: Record<string, number>
  hasIntro: boolean
  introWords: number
}

export function extractDocStructure(docText: string): DocStructure {
  const headings: string[] = []
  const wordCounts: Record<string, number> = {}
  const headingLevels: Record<string, number> = {}
  const plain = docText.replace(/<[^>]+>/g, '')
  const lines = plain.split('\n')
  let currentHeading = ''
  let currentWords = 0
  let introWords = 0
  let seenFirstHeading = false

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)/)
    if (match) {
      if (currentHeading) wordCounts[currentHeading] = currentWords
      else if (!seenFirstHeading) introWords = currentWords
      currentHeading = match[2].trim()
      headingLevels[currentHeading] = match[1].length
      headings.push(currentHeading)
      currentWords = 0
      seenFirstHeading = true
    } else {
      currentWords += line.trim().split(/\s+/).filter(Boolean).length
    }
  }
  if (currentHeading) wordCounts[currentHeading] = currentWords
  else if (!seenFirstHeading) introWords = currentWords

  const counts = Object.values(wordCounts)
  const totalWords = counts.reduce((a, b) => a + b, 0) + introWords
  const avgSectionWords = counts.length > 0 ? Math.round(totalWords / counts.length) : 0
  const threshold = Math.max(15, avgSectionWords * 0.3)

  const thinSections = headings.filter(h => (wordCounts[h] || 0) > 0 && (wordCounts[h] || 0) < threshold)
  const emptySections = headings.filter(h => (wordCounts[h] || 0) === 0)

  return {
    headings,
    wordCounts,
    totalWords,
    avgSectionWords,
    thinSections,
    emptySections,
    headingLevels,
    hasIntro: introWords > 0,
    introWords,
  }
}

export function buildPrompt(params: AskParams): string {
  const persona = params.persona || DEFAULT_PERSONAS[params.agentName] || DEFAULT_PERSONAS.Aiden
  const otherAgentList = params.otherAgents.filter(n => n !== params.agentName)
  const otherAgent = otherAgentList.length > 0 ? otherAgentList.join(', ') : 'the other agents'
  const recentChat = params.chatHistory.slice(-8).map(m => `${m.from}: ${m.text}`).join('\n')

  // Build rich context block
  let contextBlock = ''
  if (params.recentChange) {
    contextBlock += `\nRECENT CHANGE: ${params.recentChange}`
  }
  if (params.otherAgentLastAction) {
    contextBlock += `\nOTHER AGENT JUST DID: ${params.otherAgentLastAction}`
  }
  if (params.lockHolder) {
    contextBlock += `\nEDITOR LOCK: Currently held by ${params.lockHolder}`
  }
  if (params.sessionTemplate) {
    contextBlock += `\nDOC TYPE: ${params.sessionTemplate}`
  }

  // Rich document structure analysis with numbered section references
  const ds = params.docStructure
  if (ds && ds.headings.length > 0) {
    const outline = ds.headings
      .map((h, i) => {
        const wc = ds.wordCounts[h] || 0
        const level = ds.headingLevels[h] || 2
        const indent = level > 1 ? '  ' : ''
        const flag = wc === 0 ? ' [EMPTY]' : wc < (ds.avgSectionWords * 0.3) ? ' [THIN]' : ''
        return `${indent}[S${i + 1}] ${h} (${wc} words)${flag}`
      })
      .join('\n')
    contextBlock += `\nDOC STRUCTURE (${ds.totalWords} total words, avg ${ds.avgSectionWords}/section):\n${outline}`
    contextBlock += `\nPOSITION REFS: Use "after:S1", "after:S2" etc. to target sections. Example: position "after:S2" inserts after section [S2].`
    if (ds.thinSections.length > 0) {
      const thinWithRefs = ds.thinSections.map(h => {
        const idx = ds.headings.indexOf(h)
        return idx >= 0 ? `[S${idx + 1}] ${h}` : h
      })
      contextBlock += `\nWEAK SECTIONS needing expansion: ${thinWithRefs.join(', ')}`
    }
    if (ds.emptySections.length > 0) {
      const emptyWithRefs = ds.emptySections.map(h => {
        const idx = ds.headings.indexOf(h)
        return idx >= 0 ? `[S${idx + 1}] ${h}` : h
      })
      contextBlock += `\nEMPTY SECTIONS (placeholder only): ${emptyWithRefs.join(', ')}`
    }
  }

  // Extract what other agents said/did recently for collaboration context
  const otherAgentMessages = params.chatHistory
    .filter(m => otherAgentList.includes(m.from))
    .slice(-3)
  if (otherAgentMessages.length > 0) {
    contextBlock += `\nRECENT CONTRIBUTIONS FROM COLLEAGUES:\n${otherAgentMessages.map(m => `  ${m.from}: ${m.text}`).join('\n')}`
  }

  // Discovery/planning phases: override task block to prevent doc edits and guide discovery
  const isPlanning = params.phase === 'discovery' || params.phase === 'planning'

  let taskBlock = ''
  if (isPlanning) {
    // Build a context-aware prompt that biases toward action over questions
    let planningContext = ''
    if (params.docState === 'blank') {
      planningContext = `The document is blank. Take creative initiative — pick a direction from your expertise and start writing. Show the user what you can do.

Your job: Draft a strong opening section. Mention in chat what you chose and why. If the user wants something different, they'll redirect you. Don't wait for permission.`
    } else if (params.docState === 'template') {
      planningContext = `The document has a ${params.sessionTemplate || 'template'} template loaded, but the sections still have placeholder text.

Your job: Pick the highest-impact section and start filling it with real content. Tell the user what you're working on, then do it. Take initiative, but stay responsive to user direction.`
    } else if (params.docState === 'sparse') {
      planningContext = `The document has some content but it's thin — only a few sentences. Build on what's here.

Your job: Expand the most promising section with concrete details from your expertise. Comment on what's strong, then add to it. Take action, don't just ask questions.`
    }

    if (params.instruction) {
      planningContext += `\n\nThe instruction you received: "${params.instruction}"`
    }

    taskBlock = `ACTION PHASE — Bias heavily toward DOING, not asking. Create content, make plans, take initiative.

${planningContext}

Rules:
- PREFER action over questions. Write content, create plans, make proposals.
- If you must ask something, limit to ONE short question AND pair it with a concrete action.
- Reference the template structure if one exists
- Be a proactive coworker who ships, not one who schedules meetings
- Keep it short and punchy`
  } else if (params.trigger === 'autonomous') {
    taskBlock = `You are autonomously working on the document. Decide ONE useful action. Your edits apply directly — no approval needed. WRITE REAL CONTENT.

PRIORITY (do the first applicable):
1. Empty/thin sections: use "insert" to draft 2-4 paragraphs with concrete details
2. Weak claims: use "replace" to add specifics, numbers, evidence
3. Vague language: use "replace" with tighter wording
4. Structural gap: "insert" content to fill it
5. Nothing to write: "chat" with a pointed observation or question

Actions: insert (position like "after:S1" or "end" + content), replace (searchText + replaceWith), chat (chatMessage), search (query), read (highlightText), rename (newTitle)

RULES: Never duplicate headings. chatBefore required for insert/replace. shouldContinue: false unless you have a clear next step.`
  } else if (params.trigger === 'instruction') {
    // Detect if the instruction is asking the agent to write/draft/create content
    const writingKeywords = /\b(draft|write|start writing|start drafting|fill|expand|build out|create content|add content|improve|flesh out|both improve)\b/i
    const isWritingInstruction = writingKeywords.test(params.instruction || '')

    taskBlock = `The user said: "${params.instruction}"

Follow their instruction. Your edits apply directly to the document.
${isWritingInstruction ? `ACTION REQUIRED: WRITE NOW. Use "insert" with position and content containing real paragraphs. Do NOT just chat.` : ''}
- Questions from user = answer in chat
- "ok"/"sure"/"thanks" = chat only
- Everything else = take action. Use "insert" for new content, "replace" for edits.
- chatBefore required for insert/replace (brief note about what you're doing)

Respond to the LAST 2-3 chat messages, not older ones.`
  } else if (params.trigger === 'inline-doc') {
    taskBlock = `The user typed this directly in the document as an instruction to you: "${params.instruction}"

They want action in the document. You may use insert, replace, or delete to apply directly (inline instruction = permission to write). The instruction text itself should NOT appear in the document.`
  }

  // Inject agent mode modifier if available
  const modeBlock = params.agentMode
    ? `\n\nCURRENT MODE: ${params.agentMode.label}\n${params.agentMode.promptModifier}`
    : ''

  return `${persona}${modeBlock}

You are ${params.agentName} in a shared doc workspace with ${otherAgent} and the user (${params.ownerName}).

STYLE: Terse, direct, no filler, no emoji. Chat like a sharp coworker. Push back on 30%+ of responses. Quote specific text when referencing others' work.

WRITING: Active voice. Lead with main point. Be specific with numbers. One idea per paragraph. Short sentences. BANNED: delve, leverage, multifaceted, foster, realm, tapestry, pivotal, crucial, robust, seamless, groundbreaking, cutting-edge, utilize, synergy, holistic, paradigm, ecosystem.

DOCUMENT:
${truncateDoc(params.docText)}

RECENT CHAT:
${recentChat || '(none)'}
${contextBlock}

${taskBlock}

${isPlanning ? 'EARLY PHASE: Prefer action over questions.' : ''}

Rules: Never duplicate existing headings. Never return empty content fields. Keep inserts to 3-4 paragraphs max.`
}

// Validate that required fields are present and non-empty for each action type.
// Lenient: verifyAndNormalizeAction handles graceful degradation for all types.
// Only reject truly unusable actions (no type, no fields at all).
export function validateAction(action: AgentAction): boolean {
  if (!action.type) return false
  // For doc-editing actions, the verifier converts incomplete ones to chat.
  // For chat-like actions, check the minimum viable field.
  const hasText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
  switch (action.type) {
    case 'chat':
      return hasText(action.chatMessage)
    case 'search':
      return hasText(action.query)
    default:
      return true // read, plan pass through
  }
}

export async function askAgent(params: AskParams): Promise<AgentAction> {
  const ready = await rateLimiter.waitForSlot()
  if (!ready) throw new AgentError('Rate limiter disposed', 'rate_limit')

  const prompt = buildPrompt(params)
  const clientKey = getStoredApiKey()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientKey) headers['X-Gemini-Key'] = clientKey
  // Pass session context for server-side tracing
  const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
  if (sessionMatch) headers['X-Session-Id'] = sessionMatch[1]
  if (params.agentName) headers['X-Agent-Name'] = params.agentName

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    })

    if (res.status === 429) {
      rateLimiter.onRateLimit()
      throw new AgentError('Rate limit exceeded', 'rate_limit', 429, true)
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      rateLimiter.onError()
      throw new AgentError(
        errBody.error || `API error ${res.status}`,
        'api_error',
        res.status,
      )
    }

    rateLimiter.onSuccess()

    const data = await res.json()
    const action = data.action as AgentAction

    if (!action || !action.type) {
      throw new AgentError('Empty action from API', 'parse_error')
    }

    // Debug: log propose_edit fields to diagnose empty content issues
    if (action.type === 'propose_edit') {
      console.log('[agent]', params.agentName, 'propose_edit raw:', {
        editKind: action.editKind,
        editTarget: action.editTarget,
        hasAfterText: !!action.afterText?.trim(),
        hasBeforeText: !!action.beforeText?.trim(),
        afterTextLen: action.afterText?.length ?? 0,
      })
    }

    if (!validateAction(action)) {
      throw new AgentError(
        `Invalid ${action.type} action: missing or empty required fields`,
        'parse_error',
      )
    }

    console.log('[agent]', params.agentName, action.type, action.thought, action.reasoning)

    // Post-process: trim thought and reasoning
    if (action.thought) {
      action.thought = action.thought.split(/\s+/).slice(0, 4).join(' ')
    }
    if (action.reasoning && Array.isArray(action.reasoning)) {
      action.reasoning = action.reasoning.slice(0, 3).map(s => String(s).slice(0, 60))
    }

    return action
  } catch (err) {
    if (err instanceof AgentError) throw err
    console.error('[agent] catch error:', err)
    throw new AgentError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      'network_error',
      undefined,
      true,
    )
  }
}

export function disposeRateLimiter() {
  rateLimiter.dispose()
}

export function resetRateLimiter() {
  rateLimiter.reset()
}
