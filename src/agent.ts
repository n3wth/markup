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

import type { AgentProvider } from './agent/provider'
import { createGeminiProvider } from './agent/providers/gemini-provider'
import { createRateLimiter } from './agent/rate-limiter'
import { DEFAULT_PERSONAS as DEFAULT_PERSONAS_INTERNAL } from './lib/prompts'

// Client-side rate limiter: enforces minimum spacing between calls to stay within free tier limits.
// The server handles retries for transient errors via AI SDK's maxRetries.
// This limiter prevents the client from overwhelming the server with concurrent requests.
const rateLimiter = createRateLimiter()

export type AgentActionType = 'insert' | 'replace' | 'read' | 'chat' | 'search' | 'rename' | 'delete' | 'propose' | 'plan' | 'ask' | 'image' | 'propose_edit' | 'task'

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
  /** task action: propose, complete, or update */
  taskAction?: {
    type: 'propose' | 'complete' | 'update'
    taskId?: string
    title?: string
    rationale?: string
    assignedAgents?: string[]
    sectionAnchor?: string
  }
}

import type { SessionPhase } from './phase-machine'
import type { AgentMode } from './agent-modes'
import type { AgentTask } from './types'

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
  tasks?: AgentTask[]
}

// Default personas kept for backward compatibility
export { DEFAULT_PERSONAS } from './lib/prompts'

function truncateDoc(text: string, maxChars = 6000): string {
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
  const persona = params.persona || DEFAULT_PERSONAS_INTERNAL[params.agentName] || DEFAULT_PERSONAS_INTERNAL.Aiden
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

  // Inject agent mode modifier if available
  const modeBlock = params.agentMode
    ? `\nCURRENT MODE: ${params.agentMode.label}\n${params.agentMode.promptModifier}`
    : ''

  // Unified task context -- agent gets trigger and instruction, decides how to act
  const triggerContext = params.instruction ? `\nINSTRUCTION: "${params.instruction}"` : ''
  const triggerType = params.trigger === 'inline-doc' ? 'inline-doc (user typed in the doc — take action, don\'t echo the instruction text)' : params.trigger

  // Build task context if tasks exist
  let taskBlock = ''
  if (params.tasks && params.tasks.length > 0) {
    const taskLines = params.tasks
      .filter(t => t.status !== 'dismissed')
      .map(t => {
        const status = t.status === 'complete' ? 'DONE'
          : t.status === 'active' && t.assignedAgents.includes(params.agentName) ? 'ACTIVE - you'
          : t.status === 'active' ? `ACTIVE - ${t.assignedAgents.join(', ')}`
          : 'pending'
        return `${t.order}. [${status}] ${t.title} (${t.assignedAgents.join(', ')})`
      })
    const currentTask = params.tasks.find(t =>
      t.status === 'active' && t.assignedAgents.includes(params.agentName)
    )
    taskBlock = `\nTASKS (work plan):\n${taskLines.join('\n')}`
    if (currentTask) {
      taskBlock += `\n\nYour current task is #${currentTask.order}: "${currentTask.title}". Focus on this. When done, use the "task" action with type "complete".`
    } else {
      taskBlock += `\n\nNo task is assigned to you right now. Contribute via chat or wait for assignment.`
    }
  }

  return `${persona}${modeBlock}

You are ${params.agentName} in a shared doc workspace with ${otherAgent} and the user (${params.ownerName}).

TRIGGER: ${triggerType}${triggerContext}

STYLE: Terse, direct, no filler, no emoji. Chat like a sharp coworker. Push back on 30%+ of responses. Quote specific text when referencing others' work.

WRITING: Active voice. Lead with main point. Be specific with numbers. One idea per paragraph. Short sentences. BANNED: delve, leverage, multifaceted, foster, realm, tapestry, pivotal, crucial, robust, seamless, groundbreaking, cutting-edge, utilize, synergy, holistic, paradigm, ecosystem.

FORMAT: Use ## for headings, - for bullet lists. Wrap code in triple backtick fences (\`\`\`lang ... \`\`\`). Never use single backtick fences for code blocks.

DOCUMENT:
${truncateDoc(params.docText)}

RECENT CHAT:
${recentChat || '(none)'}
${contextBlock}${taskBlock}

ACTIONS AVAILABLE:
- insert: position (REQUIRED — use "after:S1" etc. or "end") + content (real paragraphs)
- replace: searchText + replaceWith
- delete: deleteText
- chat: chatMessage
- search: query
- read: highlightText
- rename: newTitle
- task: taskAction { type: "propose"|"complete", title (for propose), taskId (for complete), rationale, assignedAgents }
All doc edits require chatBefore (brief note about what you're doing).

HOW TO DECIDE:
- "instruction" trigger with a user question → answer in chat
- "instruction" trigger with a task → take action (insert/replace/delete)
- "autonomous" trigger → find ONE useful improvement. Prefer replace/delete over insert. Yield if doc looks good.
- Trivial messages ("ok", "thanks") → chat only
- Blank doc with no user direction → introduce yourself in chat, ask what to work on. Do NOT write random content.

RULES:
1. READ the document first. Never repeat existing content.
2. Never duplicate headings. Improve existing sections with "replace", don't add duplicates.
3. Keep inserts to 2-3 paragraphs max.
4. If the doc already covers a topic, use "chat" to comment.
5. Clean up redundant content with "delete" or "replace".
6. shouldContinue: false unless you have a clear next step.`
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
    case 'task':
      return !!action.taskAction && ('title' in action.taskAction || 'taskId' in action.taskAction)
    default:
      return true // read, plan pass through
  }
}

// Module-level provider singleton. Lazy-init so tests and non-Gemini wiring
// (Wave 2/3 Claude + OpenAI adapters) can swap via setAgentProvider before
// the first call. Resets on resetRateLimiter() for test isolation.
let provider: AgentProvider | null = null
function getProvider(): AgentProvider {
  if (!provider) provider = createGeminiProvider()
  return provider
}

export async function askAgent(params: AskParams): Promise<AgentAction> {
  const ready = await rateLimiter.waitForSlot()
  if (!ready) throw new AgentError('Rate limiter disposed', 'rate_limit')

  try {
    const { action } = await getProvider().generate(params)

    rateLimiter.onSuccess()

    if (!action || !action.type) {
      throw new AgentError('Empty action from API', 'parse_error')
    }

    // Debug: log propose_edit fields to diagnose empty content issues
    if (action.type === 'propose_edit' && import.meta.env.DEV) {
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

    if (import.meta.env.DEV) console.log('[agent]', params.agentName, action.type, action.thought, action.reasoning)

    // Post-process: trim thought and reasoning
    if (action.thought) {
      action.thought = action.thought.split(/\s+/).slice(0, 4).join(' ')
    }
    if (action.reasoning && Array.isArray(action.reasoning)) {
      action.reasoning = action.reasoning.slice(0, 3).map(s => String(s).slice(0, 60))
    }

    return action
  } catch (err) {
    if (err instanceof AgentError) {
      // Map provider-raised errors back to rate-limiter state transitions.
      if (err.code === 'rate_limit' && err.status === 429) {
        rateLimiter.onRateLimit()
      } else if (err.code === 'api_error') {
        rateLimiter.onError()
      }
      throw err
    }
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
  provider?.dispose()
  provider = null
}

export function resetRateLimiter() {
  rateLimiter.reset()
  provider?.dispose()
  provider = null
}
