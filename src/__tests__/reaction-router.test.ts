import { describe, it, expect } from 'vitest'
import { createReactionRouter } from '../orchestrator/reaction-router'

const agents = [
  { name: 'Aiden' },
  { name: 'Nova' },
  { name: 'Lex' },
]

describe('createReactionRouter', () => {
  describe('pendingReaction', () => {
    it('defaults to null and toggles via set/clear', () => {
      const r = createReactionRouter({ agents })
      expect(r.getPending()).toBeNull()
      r.setPending('Aiden')
      expect(r.getPending()).toBe('Aiden')
      r.clearPending()
      expect(r.getPending()).toBeNull()
    })

    it('isPending reflects whether an agent currently holds the slot', () => {
      const r = createReactionRouter({ agents })
      expect(r.isPending('Aiden')).toBe(false)
      r.setPending('Aiden')
      expect(r.isPending('Aiden')).toBe(true)
      expect(r.isPending('Nova')).toBe(false)
    })

    it('clearPendingIf only clears when the agent matches', () => {
      const r = createReactionRouter({ agents })
      r.setPending('Aiden')
      r.clearPendingIf('Nova')
      expect(r.getPending()).toBe('Aiden')
      r.clearPendingIf('Aiden')
      expect(r.getPending()).toBeNull()
    })

    it('clearPendingIf is a no-op when no agent is pending', () => {
      const r = createReactionRouter({ agents })
      r.clearPendingIf('Aiden')
      expect(r.getPending()).toBeNull()
    })

    it('setPending overwrites the previous pending agent', () => {
      const r = createReactionRouter({ agents })
      r.setPending('Aiden')
      r.setPending('Nova')
      expect(r.getPending()).toBe('Nova')
      expect(r.isPending('Aiden')).toBe(false)
    })
  })

  describe('round-robin selection', () => {
    it('rotates through candidates in order', () => {
      const r = createReactionRouter({ agents })
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Nova')
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Lex')
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Nova')
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Lex')
    })

    it('wraps around when the index exceeds candidate length', () => {
      const r = createReactionRouter({ agents })
      for (let i = 0; i < 5; i++) r.pickNextReactor(['Nova', 'Lex'])
      expect(r.getRoundRobinIndex()).toBe(5)
      // Index 5 % 2 === 1 -> 'Lex'
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Lex')
    })

    it('returns null for an empty candidate list and does not advance the index', () => {
      const r = createReactionRouter({ agents })
      expect(r.pickNextReactor([])).toBeNull()
      expect(r.getRoundRobinIndex()).toBe(0)
      // Subsequent non-empty call starts at index 0
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Nova')
    })

    it('advances the shared index regardless of candidate-list size', () => {
      const r = createReactionRouter({ agents })
      r.pickNextReactor(['Nova']) // idx 0 -> 'Nova', index becomes 1
      r.pickNextReactor(['Nova', 'Lex']) // idx 1 % 2 -> 'Lex', index becomes 2
      expect(r.pickNextReactor(['Nova', 'Lex', 'Mira'])).toBe('Mira') // idx 2 % 3 -> 'Mira'
      expect(r.getRoundRobinIndex()).toBe(3)
    })

    it('handles a single-candidate list (always returns that candidate)', () => {
      const r = createReactionRouter({ agents })
      expect(r.pickNextReactor(['Nova'])).toBe('Nova')
      expect(r.pickNextReactor(['Nova'])).toBe('Nova')
      expect(r.pickNextReactor(['Nova'])).toBe('Nova')
      expect(r.getRoundRobinIndex()).toBe(3)
    })
  })

  describe('reset', () => {
    it('clears the pending agent and zeroes the round-robin index', () => {
      const r = createReactionRouter({ agents })
      r.setPending('Aiden')
      r.pickNextReactor(['Nova', 'Lex'])
      r.pickNextReactor(['Nova', 'Lex'])
      expect(r.getPending()).toBe('Aiden')
      expect(r.getRoundRobinIndex()).toBe(2)

      r.reset()
      expect(r.getPending()).toBeNull()
      expect(r.getRoundRobinIndex()).toBe(0)
      // Next pick starts at index 0 again
      expect(r.pickNextReactor(['Nova', 'Lex'])).toBe('Nova')
    })
  })

  describe('instance isolation', () => {
    it('separate routers do not share state', () => {
      const a = createReactionRouter({ agents })
      const b = createReactionRouter({ agents })
      a.setPending('Aiden')
      a.pickNextReactor(['Nova', 'Lex'])
      expect(b.getPending()).toBeNull()
      expect(b.getRoundRobinIndex()).toBe(0)
    })
  })
})
