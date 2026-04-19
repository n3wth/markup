import { describe, it, expect } from 'vitest'
import { createTurnQueue, type TurnRequest } from '../orchestrator/turn-queue'

const agents = [
  { name: 'Aiden' },
  { name: 'Nova' },
]

function req(agent: string, overrides: Partial<TurnRequest> = {}): TurnRequest {
  return { agent, trigger: 'instruction', ...overrides }
}

describe('createTurnQueue', () => {
  describe('enqueue / dequeue', () => {
    it('push returns new queue length and FIFO order is preserved on shift', () => {
      const q = createTurnQueue({ agents })
      expect(q.push(req('Aiden'))).toBe(1)
      expect(q.push(req('Nova'))).toBe(2)
      expect(q.push(req('Aiden', { instruction: 'third' }))).toBe(3)

      expect(q.size()).toBe(3)
      expect(q.shift()?.agent).toBe('Aiden')
      expect(q.shift()?.agent).toBe('Nova')
      expect(q.shift()?.instruction).toBe('third')
      expect(q.shift()).toBeUndefined()
      expect(q.size()).toBe(0)
    })

    it('clear empties the queue without disturbing counters', () => {
      const q = createTurnQueue({ agents })
      q.push(req('Aiden'))
      q.push(req('Nova'))
      q.incrementTurnCount('Aiden')
      q.incrementExchange()

      q.clear()
      expect(q.size()).toBe(0)
      expect(q.getTurnCount('Aiden')).toBe(1)
      expect(q.getExchangeCount()).toBe(1)
    })

    it('removeAgent deletes every pending request for an agent and preserves the rest', () => {
      const q = createTurnQueue({ agents })
      q.push(req('Aiden'))
      q.push(req('Nova'))
      q.push(req('Aiden', { instruction: 'again' }))
      q.push(req('Nova', { instruction: 'later' }))

      q.removeAgent('Aiden')
      expect(q.size()).toBe(2)
      expect(q.hasAgent('Aiden')).toBe(false)
      expect(q.hasAgent('Nova')).toBe(true)
      expect(q.shift()?.agent).toBe('Nova')
      expect(q.shift()?.instruction).toBe('later')
    })

    it('hasAgent reflects current queue membership', () => {
      const q = createTurnQueue({ agents })
      expect(q.hasAgent('Aiden')).toBe(false)
      q.push(req('Aiden'))
      expect(q.hasAgent('Aiden')).toBe(true)
      q.shift()
      expect(q.hasAgent('Aiden')).toBe(false)
    })
  })

  describe('processing flag', () => {
    it('defaults to false and toggles on setProcessing', () => {
      const q = createTurnQueue({ agents })
      expect(q.isProcessing()).toBe(false)
      q.setProcessing(true)
      expect(q.isProcessing()).toBe(true)
      q.setProcessing(false)
      expect(q.isProcessing()).toBe(false)
    })

    it('reset releases the processing flag', () => {
      const q = createTurnQueue({ agents })
      q.setProcessing(true)
      q.reset()
      expect(q.isProcessing()).toBe(false)
    })
  })

  describe('turnCount', () => {
    it('seeds zero counts for agents passed at construction', () => {
      const q = createTurnQueue({ agents })
      expect(q.getTurnCount('Aiden')).toBe(0)
      expect(q.getTurnCount('Nova')).toBe(0)
    })

    it('returns 0 for unknown agents without mutating state', () => {
      const q = createTurnQueue({ agents })
      expect(q.getTurnCount('Ghost')).toBe(0)
    })

    it('incrementTurnCount increments only the targeted agent', () => {
      const q = createTurnQueue({ agents })
      q.incrementTurnCount('Aiden')
      q.incrementTurnCount('Aiden')
      q.incrementTurnCount('Nova')
      expect(q.getTurnCount('Aiden')).toBe(2)
      expect(q.getTurnCount('Nova')).toBe(1)
    })

    it('ensureAgent seeds new agents at zero and is idempotent for known agents', () => {
      const q = createTurnQueue({ agents })
      q.incrementTurnCount('Aiden')
      q.ensureAgent('Aiden')
      expect(q.getTurnCount('Aiden')).toBe(1)

      q.ensureAgent('Lex')
      expect(q.getTurnCount('Lex')).toBe(0)
      q.incrementTurnCount('Lex')
      expect(q.getTurnCount('Lex')).toBe(1)
    })

    it('resetTurnCounts zeroes every seeded counter', () => {
      const q = createTurnQueue({ agents })
      q.incrementTurnCount('Aiden')
      q.incrementTurnCount('Nova')
      q.incrementTurnCount('Nova')
      q.resetTurnCounts()
      expect(q.getTurnCount('Aiden')).toBe(0)
      expect(q.getTurnCount('Nova')).toBe(0)
    })

    it('isTurnLimitReached reflects the current count versus the cap', () => {
      const q = createTurnQueue({ agents })
      q.incrementTurnCount('Aiden')
      expect(q.isTurnLimitReached('Aiden', 2)).toBe(false)
      q.incrementTurnCount('Aiden')
      expect(q.isTurnLimitReached('Aiden', 2)).toBe(true)
      expect(q.isTurnLimitReached('Nova', 2)).toBe(false)
    })
  })

  describe('exchangeCount', () => {
    it('starts at zero and increments', () => {
      const q = createTurnQueue({ agents })
      expect(q.getExchangeCount()).toBe(0)
      q.incrementExchange()
      q.incrementExchange()
      expect(q.getExchangeCount()).toBe(2)
    })

    it('resetExchangeCount returns the counter to zero', () => {
      const q = createTurnQueue({ agents })
      q.incrementExchange()
      q.incrementExchange()
      q.resetExchangeCount()
      expect(q.getExchangeCount()).toBe(0)
    })

    it('isExchangeLimitReached caps at maxExchanges inclusively', () => {
      const q = createTurnQueue({ agents })
      expect(q.isExchangeLimitReached(2)).toBe(false)
      q.incrementExchange()
      expect(q.isExchangeLimitReached(2)).toBe(false)
      q.incrementExchange()
      expect(q.isExchangeLimitReached(2)).toBe(true)
    })
  })

  describe('reset semantics', () => {
    it('reset clears queue, processing, counts, and exchange counter', () => {
      const q = createTurnQueue({ agents })
      q.push(req('Aiden'))
      q.push(req('Nova'))
      q.setProcessing(true)
      q.incrementTurnCount('Aiden')
      q.incrementTurnCount('Nova')
      q.incrementExchange()

      q.reset()

      expect(q.size()).toBe(0)
      expect(q.isProcessing()).toBe(false)
      expect(q.getTurnCount('Aiden')).toBe(0)
      expect(q.getTurnCount('Nova')).toBe(0)
      expect(q.getExchangeCount()).toBe(0)
    })

    it('reset is safe on an already-empty queue', () => {
      const q = createTurnQueue({ agents })
      q.reset()
      expect(q.size()).toBe(0)
      expect(q.isProcessing()).toBe(false)
    })

    it('state survives until reset — no implicit cleanup on shift', () => {
      const q = createTurnQueue({ agents })
      q.push(req('Aiden'))
      q.incrementTurnCount('Aiden')
      q.incrementExchange()
      q.shift()
      // Shifting a turn should NOT reset counters; reset must be explicit.
      expect(q.getTurnCount('Aiden')).toBe(1)
      expect(q.getExchangeCount()).toBe(1)
    })
  })

  describe('instance isolation', () => {
    it('two queues share no state', () => {
      const a = createTurnQueue({ agents })
      const b = createTurnQueue({ agents })
      a.push(req('Aiden'))
      a.incrementTurnCount('Aiden')
      a.incrementExchange()
      expect(b.size()).toBe(0)
      expect(b.getTurnCount('Aiden')).toBe(0)
      expect(b.getExchangeCount()).toBe(0)
    })
  })
})
