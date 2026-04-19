import type { AgentTask } from './types'

export type CelebrationKind = 'first-1000-words' | 'all-tasks-complete' | 'first-share'

const STORAGE_PREFIX = 'collab-celebrated:'

function storageKey(sessionId: string, kind: CelebrationKind): string {
  return `${STORAGE_PREFIX}${sessionId}:${kind}`
}

export function hasCelebrated(sessionId: string, kind: CelebrationKind): boolean {
  try {
    return localStorage.getItem(storageKey(sessionId, kind)) === '1'
  } catch {
    return false
  }
}

export function markCelebrated(sessionId: string, kind: CelebrationKind): void {
  try {
    localStorage.setItem(storageKey(sessionId, kind), '1')
  } catch {
    // localStorage unavailable; degrade gracefully — milestone may re-fire.
  }
}

export function clearCelebrations(sessionId: string): void {
  try {
    for (const kind of ['first-1000-words', 'all-tasks-complete', 'first-share'] as CelebrationKind[]) {
      localStorage.removeItem(storageKey(sessionId, kind))
    }
  } catch {
    // nothing to do
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function reachedWordMilestone(text: string, threshold = 1000): boolean {
  return countWords(text) >= threshold
}

export function tasksAllComplete(tasks: AgentTask[]): boolean {
  if (tasks.length === 0) return false
  return tasks.every(t => t.status === 'complete' || t.status === 'dismissed')
    && tasks.some(t => t.status === 'complete')
}

export interface CelebrationLabel {
  title: string
  detail: string
}

export const CELEBRATION_LABELS: Record<CelebrationKind, CelebrationLabel> = {
  'first-1000-words': { title: '1,000 words', detail: 'A full-bodied draft.' },
  'all-tasks-complete': { title: 'All tasks complete', detail: 'The plan is done.' },
  'first-share': { title: 'Shared', detail: 'Out into the world.' },
}
