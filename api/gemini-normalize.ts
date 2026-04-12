type GeminiAction = Record<string, unknown>

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function truncateThought(thought: string): string {
  return thought.split(/\s+/).slice(0, 4).join(' ')
}

function looksLikeDocContent(text: string): boolean {
  if (!text) return false
  if (text.includes('\n')) return true
  if (/^#{1,6}\s|^- |\d+\. /m.test(text)) return true
  if (/[.!?][\s"')\]]*$/.test(text)) return true
  if (text.length >= 24) return true
  return text.split(/\s+/).filter(Boolean).length >= 5
}

export function normalizeGeminiAction(input: GeminiAction): GeminiAction {
  const action = { ...input }
  const content = readText(action.content)
  const afterText = readText(action.afterText)
  const thought = readText(action.thought)
  const isInsert = action.type === 'insert'
  const isProposeInsert = action.type === 'propose_edit' && action.editKind === 'insert'

  if (isInsert && !content && afterText) {
    action.content = afterText
  }
  if (isProposeInsert && !afterText && content) {
    action.afterText = content
  }

  const normalizedContent = readText(action.content)
  const normalizedAfterText = readText(action.afterText)
  const hasDocContent = !!(normalizedContent || normalizedAfterText)

  if (!hasDocContent && thought && (isInsert || isProposeInsert) && looksLikeDocContent(thought)) {
    if (isInsert) {
      action.content = thought
    } else {
      action.afterText = thought
    }
    action.thought = truncateThought(thought)
  }

  if (isInsert && !readText(action.content)) {
    throw new Error('Insert action missing content after normalization')
  }

  if (isProposeInsert && !readText(action.afterText)) {
    throw new Error('Propose-edit insert missing afterText after normalization')
  }

  return action
}
