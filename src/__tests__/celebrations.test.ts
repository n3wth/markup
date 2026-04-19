import { beforeEach, describe, expect, it, vi } from 'vitest'

// Tests run in node; stub a minimal localStorage so the persistence
// helpers behave the same as in a browser.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  clear(): void { this.store.clear() }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null }
  get length(): number { return this.store.size }
}

const memoryStorage = new MemoryStorage()
;(globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage as unknown as Storage
;(globalThis as unknown as { Storage: typeof MemoryStorage }).Storage = MemoryStorage

import {
  CELEBRATION_LABELS,
  clearCelebrations,
  countWords,
  hasCelebrated,
  markCelebrated,
  reachedWordMilestone,
  tasksAllComplete,
} from '../celebrations'
import type { AgentTask } from '../types'

const task = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: overrides.id ?? 't1',
  sessionId: 's1',
  title: 'task',
  status: overrides.status ?? 'pending',
  assignedAgents: [],
  createdBy: 'user',
  order: 1,
  createdAt: '2026-04-19T00:00:00Z',
  ...overrides,
})

describe('countWords', () => {
  it('handles whitespace and punctuation', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
    expect(countWords('one two three')).toBe(3)
    expect(countWords('  hello\n\nworld\t!')).toBe(3)
  })
})

describe('reachedWordMilestone', () => {
  it('triggers at and above threshold', () => {
    expect(reachedWordMilestone('word '.repeat(999), 1000)).toBe(false)
    expect(reachedWordMilestone('word '.repeat(1000), 1000)).toBe(true)
    expect(reachedWordMilestone('word '.repeat(1500), 1000)).toBe(true)
  })

  it('respects custom threshold', () => {
    expect(reachedWordMilestone('one two three four five', 5)).toBe(true)
    expect(reachedWordMilestone('one two three four', 5)).toBe(false)
  })
})

describe('tasksAllComplete', () => {
  it('returns false for an empty list', () => {
    expect(tasksAllComplete([])).toBe(false)
  })

  it('returns false when any task is pending or active', () => {
    expect(tasksAllComplete([task({ status: 'complete' }), task({ id: 't2', status: 'pending' })])).toBe(false)
    expect(tasksAllComplete([task({ status: 'active' })])).toBe(false)
  })

  it('returns true when every task is complete', () => {
    expect(tasksAllComplete([
      task({ id: 't1', status: 'complete' }),
      task({ id: 't2', status: 'complete' }),
    ])).toBe(true)
  })

  it('treats dismissed as terminal but requires at least one completion', () => {
    expect(tasksAllComplete([task({ status: 'dismissed' })])).toBe(false)
    expect(tasksAllComplete([
      task({ id: 't1', status: 'complete' }),
      task({ id: 't2', status: 'dismissed' }),
    ])).toBe(true)
  })
})

describe('celebration persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('records and reads fired milestones per session', () => {
    expect(hasCelebrated('s1', 'first-1000-words')).toBe(false)
    markCelebrated('s1', 'first-1000-words')
    expect(hasCelebrated('s1', 'first-1000-words')).toBe(true)
    expect(hasCelebrated('s1', 'all-tasks-complete')).toBe(false)
    expect(hasCelebrated('s2', 'first-1000-words')).toBe(false)
  })

  it('clears all celebrations for a session', () => {
    markCelebrated('s1', 'first-1000-words')
    markCelebrated('s1', 'all-tasks-complete')
    markCelebrated('s1', 'first-share')
    clearCelebrations('s1')
    expect(hasCelebrated('s1', 'first-1000-words')).toBe(false)
    expect(hasCelebrated('s1', 'all-tasks-complete')).toBe(false)
    expect(hasCelebrated('s1', 'first-share')).toBe(false)
  })

  it('returns false when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(hasCelebrated('s1', 'first-1000-words')).toBe(false)
  })

  it('does not throw when setItem fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => markCelebrated('s1', 'first-share')).not.toThrow()
  })
})

describe('CELEBRATION_LABELS', () => {
  it('has copy for every kind', () => {
    expect(CELEBRATION_LABELS['first-1000-words'].title).toBeTruthy()
    expect(CELEBRATION_LABELS['all-tasks-complete'].title).toBeTruthy()
    expect(CELEBRATION_LABELS['first-share'].title).toBeTruthy()
  })
})
