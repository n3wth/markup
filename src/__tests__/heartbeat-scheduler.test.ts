import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub window.setTimeout / clearTimeout so timers are deterministic.
const timers: { id: number, fn: () => void, ms: number }[] = []
let nextTimerId = 1

vi.stubGlobal('window', {
  setTimeout: (fn: () => void, ms: number) => {
    const id = nextTimerId++
    timers.push({ id, fn, ms })
    return id
  },
  clearTimeout: (id: number) => {
    const idx = timers.findIndex(t => t.id === id)
    if (idx >= 0) timers.splice(idx, 1)
  },
})

// Also stub the global clearTimeout that the scheduler uses in clearAll().
vi.stubGlobal('clearTimeout', (id: number) => {
  const idx = timers.findIndex(t => t.id === id)
  if (idx >= 0) timers.splice(idx, 1)
})

import { createHeartbeatScheduler } from '../orchestrator/heartbeat-scheduler'

function makeScheduler(overrides: Partial<Parameters<typeof createHeartbeatScheduler>[0]> = {}) {
  return createHeartbeatScheduler({
    heartbeatDelayMs: [20000, 30000],
    fire: vi.fn(),
    ...overrides,
  })
}

function fireTimer(id: number) {
  const timer = timers.find(t => t.id === id)
  if (!timer) throw new Error(`Timer ${id} not found`)
  // Remove from list (mimic browser behavior when a scheduled fn runs)
  timers.splice(timers.indexOf(timer), 1)
  timer.fn()
}

describe('createHeartbeatScheduler', () => {
  beforeEach(() => {
    timers.length = 0
    nextTimerId = 1
    vi.clearAllMocks()
  })

  describe('schedule', () => {
    it('registers a timer with the requested delay and returns its id', () => {
      const s = makeScheduler()
      const cb = vi.fn()
      const id = s.schedule(cb, 500)
      expect(id).toBeGreaterThan(0)
      expect(timers).toHaveLength(1)
      expect(timers[0].ms).toBe(500)
    })

    it('runs the callback when the timer fires', () => {
      const s = makeScheduler()
      const cb = vi.fn()
      const id = s.schedule(cb, 100)
      expect(cb).not.toHaveBeenCalled()
      fireTimer(id)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('tracks multiple concurrent timers independently', () => {
      const s = makeScheduler()
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      const cb3 = vi.fn()
      s.schedule(cb1, 100)
      s.schedule(cb2, 200)
      s.schedule(cb3, 300)
      expect(timers).toHaveLength(3)
    })

    it('guards callbacks so they do not run after destroy(), even if the timer still fires', () => {
      const s = makeScheduler()
      const cb = vi.fn()
      // Grab the wrapper function the scheduler hands to setTimeout before destroy clears it.
      s.schedule(cb, 100)
      const wrapper = timers[0].fn
      s.destroy()
      // Simulate a stray/late timer invocation after destroy — the internal `destroyed`
      // flag in the wrapper must short-circuit the user callback.
      wrapper()
      expect(cb).not.toHaveBeenCalled()
    })

    it('returns 0 and does not schedule after destroy()', () => {
      const s = makeScheduler()
      s.destroy()
      const cb = vi.fn()
      const id = s.schedule(cb, 100)
      expect(id).toBe(0)
      expect(timers).toHaveLength(0)
    })

    it('removes the timer id from tracking after it fires naturally', () => {
      const s = makeScheduler()
      const id = s.schedule(() => undefined, 100)
      expect(timers).toHaveLength(1)
      fireTimer(id)
      // After firing, the internal Set should have dropped this id — clearAll() must
      // not try to clear it again. Clearing all should succeed without error.
      s.clearAll()
      expect(timers).toHaveLength(0)
    })
  })

  describe('clearAll', () => {
    it('cancels every pending scheduled timer', () => {
      const s = makeScheduler()
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      s.schedule(cb1, 100)
      s.schedule(cb2, 200)
      s.clearAll()
      expect(timers).toHaveLength(0)
      expect(cb1).not.toHaveBeenCalled()
      expect(cb2).not.toHaveBeenCalled()
    })

    it('is idempotent on an empty scheduler', () => {
      const s = makeScheduler()
      s.clearAll()
      s.clearAll()
      expect(timers).toHaveLength(0)
    })

    it('also cancels the heartbeat timer', () => {
      const fire = vi.fn()
      const s = makeScheduler({ fire })
      s.startHeartbeat()
      expect(timers).toHaveLength(1)
      s.clearAll()
      expect(timers).toHaveLength(0)
      expect(fire).not.toHaveBeenCalled()
    })
  })

  describe('heartbeat lifecycle', () => {
    it('startHeartbeat schedules a timer within the configured min-max range', () => {
      const s = makeScheduler({ heartbeatDelayMs: [20000, 30000] })
      s.startHeartbeat()
      expect(timers).toHaveLength(1)
      expect(timers[0].ms).toBeGreaterThanOrEqual(20000)
      expect(timers[0].ms).toBeLessThanOrEqual(30000)
    })

    it('uses the demo-mode 8-12s range when demoMode=true', () => {
      const s = makeScheduler({ heartbeatDelayMs: [20000, 30000], demoMode: true })
      s.startHeartbeat()
      expect(timers).toHaveLength(1)
      expect(timers[0].ms).toBeGreaterThanOrEqual(8000)
      expect(timers[0].ms).toBeLessThanOrEqual(12000)
    })

    it('calls the fire callback when the heartbeat timer elapses', () => {
      const fire = vi.fn()
      const s = makeScheduler({ fire })
      s.startHeartbeat()
      const id = timers[0].id
      fireTimer(id)
      expect(fire).toHaveBeenCalledTimes(1)
    })

    it('startHeartbeat cancels any existing heartbeat before scheduling a new one', () => {
      const s = makeScheduler()
      s.startHeartbeat()
      expect(timers).toHaveLength(1)
      const firstId = timers[0].id
      s.startHeartbeat()
      // The old one should be cancelled; only the new one remains.
      expect(timers).toHaveLength(1)
      expect(timers.some(t => t.id === firstId)).toBe(false)
    })

    it('stopHeartbeat cancels the pending heartbeat', () => {
      const s = makeScheduler()
      s.startHeartbeat()
      expect(timers).toHaveLength(1)
      s.stopHeartbeat()
      expect(timers).toHaveLength(0)
    })

    it('stopHeartbeat is a no-op when no heartbeat is scheduled', () => {
      const s = makeScheduler()
      s.stopHeartbeat()
      expect(timers).toHaveLength(0)
    })

    it('startHeartbeat is a no-op after destroy()', () => {
      const s = makeScheduler()
      s.destroy()
      s.startHeartbeat()
      expect(timers).toHaveLength(0)
    })
  })

  describe('destroy', () => {
    it('clears every tracked timer', () => {
      const s = makeScheduler()
      s.schedule(() => undefined, 100)
      s.schedule(() => undefined, 200)
      s.startHeartbeat()
      expect(timers).toHaveLength(3)
      s.destroy()
      expect(timers).toHaveLength(0)
    })

    it('prevents further scheduling after it runs', () => {
      const s = makeScheduler()
      s.destroy()
      s.schedule(() => undefined, 100)
      s.startHeartbeat()
      expect(timers).toHaveLength(0)
    })

    it('is safe to call twice', () => {
      const s = makeScheduler()
      s.schedule(() => undefined, 100)
      s.destroy()
      s.destroy()
      expect(timers).toHaveLength(0)
    })
  })

  describe('instance isolation', () => {
    it('two schedulers share no timer state', () => {
      const a = makeScheduler()
      const b = makeScheduler()
      a.schedule(() => undefined, 100)
      expect(timers).toHaveLength(1)
      b.clearAll()
      // b's clearAll should NOT cancel a's timer.
      expect(timers).toHaveLength(1)
      a.destroy()
      expect(timers).toHaveLength(0)
    })
  })
})
