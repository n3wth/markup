import type { AgentAction } from './agent'

const MAX_INSERT_CHARS = 8000
const MAX_REPLACE_CHARS = 4000
const MAX_SOURCES = 5

export interface VerifyOptions {
  /** Only user-approved apply path sets true so insert/replace/delete execute */
  allowDirectDocEdit: boolean
}

function clampStr(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + '\n[truncated]'
}

function toProposeEditFromInsert(a: AgentAction): AgentAction {
  return {
    type: 'propose_edit',
    editKind: 'insert',
    editTarget: a.position,
    afterText: clampStr(a.content || '', MAX_INSERT_CHARS),
    beforeText: undefined,
    editRationale: a.chatBefore,
    chatMessage: a.chatMessage || a.chatBefore || 'Proposed addition for your review.',
    thought: a.thought,
    reasoning: a.reasoning,
    shouldContinue: false,
  }
}

function toProposeEditFromReplace(a: AgentAction): AgentAction {
  return {
    type: 'propose_edit',
    editKind: 'replace',
    beforeText: clampStr(a.searchText || '', MAX_REPLACE_CHARS),
    afterText: clampStr(a.replaceWith || '', MAX_REPLACE_CHARS),
    editRationale: a.chatBefore,
    chatMessage: a.chatMessage || 'Proposed replacement for your review.',
    thought: a.thought,
    reasoning: a.reasoning,
    shouldContinue: false,
  }
}

function toProposeEditFromDelete(a: AgentAction): AgentAction {
  return {
    type: 'propose_edit',
    editKind: 'delete',
    beforeText: clampStr(a.deleteText || '', MAX_REPLACE_CHARS),
    afterText: '',
    editRationale: a.chatBefore,
    chatMessage: a.chatMessage || 'Proposed deletion for your review.',
    thought: a.thought,
    reasoning: a.reasoning,
    shouldContinue: false,
  }
}

/**
 * Normalize API fields, clamp sizes, and convert direct doc mutations to propose_edit
 * unless this is the user-approved apply path.
 */
export function verifyAndNormalizeAction(action: AgentAction, opts: VerifyOptions): AgentAction {
  if (opts.allowDirectDocEdit) {
    if (action.type === 'insert' && action.content) {
      action.content = clampStr(action.content, MAX_INSERT_CHARS)
    }
    if (action.type === 'replace') {
      if (action.searchText) action.searchText = clampStr(action.searchText, MAX_REPLACE_CHARS)
      if (action.replaceWith) action.replaceWith = clampStr(action.replaceWith, MAX_REPLACE_CHARS)
    }
    if (action.type === 'delete' && action.deleteText) {
      action.deleteText = clampStr(action.deleteText, MAX_REPLACE_CHARS)
    }
    return action
  }

  if (action.type === 'insert') return toProposeEditFromInsert(action)
  if (action.type === 'replace') return toProposeEditFromReplace(action)
  if (action.type === 'delete') return toProposeEditFromDelete(action)

  if (action.type === 'propose_edit') {
    const k = action.editKind
    if (action.afterText) action.afterText = clampStr(action.afterText, MAX_INSERT_CHARS)
    if (action.beforeText) action.beforeText = clampStr(action.beforeText, MAX_REPLACE_CHARS)
    if (action.sources && action.sources.length > MAX_SOURCES) {
      action.sources = action.sources.slice(0, MAX_SOURCES)
    }
    if (!action.chatMessage || !action.chatMessage.trim()) {
      action.chatMessage = k === 'delete'
        ? 'Proposed removal — see preview.'
        : 'Proposed doc change — see preview.'
    }
    if (!k || (k === 'insert' && !action.afterText?.trim())) {
      return {
        type: 'chat',
        chatMessage: action.editRationale || action.chatMessage || 'Could not form a valid edit proposal.',
        reasoning: action.reasoning,
        shouldContinue: false,
      }
    }
    if (k === 'replace' && (!action.beforeText?.trim() || !action.afterText?.trim())) {
      return {
        type: 'chat',
        chatMessage: action.chatMessage || 'Replace proposal needs both before and after text.',
        reasoning: action.reasoning,
        shouldContinue: false,
      }
    }
    if (k === 'delete' && !action.beforeText?.trim()) {
      return {
        type: 'chat',
        chatMessage: action.chatMessage || 'Delete proposal needs the exact text to remove.',
        reasoning: action.reasoning,
        shouldContinue: false,
      }
    }
  }

  return action
}
