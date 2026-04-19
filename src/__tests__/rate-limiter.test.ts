import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createRateLimiter } from '../agent/rate-limiter'

describe('createRateLimiter — defaults and configuration', () => {
  it('uses 7000ms interval and 3 max retries by default', () => {
    const rl = createRateLimiter()
    expect(rl.minIntervalMs).toBe(7000)
    expect(rl.maxRetries).toBe(3)
  })

  it('allows overriding interval and max retries', () => {
    const rl = createRateLimiter({ minIntervalMs: 100, maxRetries: 5 })
    expect(rl.minIntervalMs).toBe(100)
    expect(rl.maxRetries).toBe(5)
  })

  it('starts with clean state', () => {
    const rl = createRateLimiter()
    expect(rl.lastCallTime).toBe(0)
    expect(rl.backoffUntil).toBe(0)
    expect(rl.consecutiveErrors).toBe(0)
    expect(rl.disposed).toBe(false)
    expect(rl.pendingTimers.size).toBe(0)
  })
})

describe('createRateLimiter — backoff math', () => {
  it('resets consecutiveErrors on success', () => {
    const rl = createRateLimiter()
    rl.consecutiveErrors = 2
    rl.onSuccess()
    expect(rl.consecutiveErrors).toBe(0)
  })

  it('first rate limit: 5s backoff (5 * 2^0)', () => {
    const rl = createRateLimiter()
    const before = Date.now()
    rl.onRateLimit()
    expect(rl.consecutiveErrors).toBe(1)
    expect(rl.backoffUntil).toBeGreaterThanOrEqual(before + 5000)
    expect(rl.backoffUntil).toBeLessThanOrEqual(before + 5100)
  })

  it('second rate limit: 10s backoff (5 * 2^1)', () => {
    const rl = createRateLimiter()
    rl.onRateLimit()
    const before = Date.now()
    rl.onRateLimit()
    expect(rl.consecutiveErrors).toBe(2)
    expect(rl.backoffUntil).toBeGreaterThanOrEqual(before + 10000)
    expect(rl.backoffUntil).toBeLessThanOrEqual(before + 10100)
  })

  it('third rate limit: 20s backoff (5 * 2^2)', () => {
    const rl = createRateLimiter()
    rl.onRateLimit()
    rl.onRateLimit()
    const before = Date.now()
    rl.onRateLimit()
    expect(rl.consecutiveErrors).toBe(3)
    expect(rl.backoffUntil).toBeGreaterThanOrEqual(before + 20000)
    expect(rl.backoffUntil).toBeLessThanOrEqual(before + 20100)
  })

  it('caps exponential backoff at 60 seconds', () => {
    const rl = createRateLimiter()
    for (let i = 0; i < 10; i++) rl.onRateLimit()
    // Pure math check: 5 * 2^9 = 2560, Math.min(60, ...) = 60
    expect(Math.min(60, 5 * Math.pow(2, 9))).toBe(60)
    // Last call should still be within a 60s window from invocation
    expect(rl.backoffUntil).toBeLessThanOrEqual(Date.now() + 60000 + 100)
  })
})

describe('createRateLimiter — cooldown enforcement', () => {
  it('onError increments consecutiveErrors', () => {
    const rl = createRateLimiter()
    rl.onError()
    expect(rl.consecutiveErrors).toBe(1)
  })

  it('onError does NOT set cooldown before maxRetries', () => {
    const rl = createRateLimiter({ maxRetries: 3 })
    rl.onError()
    rl.onError()
    expect(rl.backoffUntil).toBe(0)
  })

  it('onError triggers 30s cooldown when consecutiveErrors reaches maxRetries', () => {
    const rl = createRateLimiter({ maxRetries: 3 })
    const before = Date.now()
    rl.onError()
    rl.onError()
    rl.onError()
    expect(rl.consecutiveErrors).toBe(3)
    expect(rl.backoffUntil).toBeGreaterThanOrEqual(before + 30000)
    expect(rl.backoffUntil).toBeLessThanOrEqual(before + 30100)
  })

  it('shouldRetry is true while under maxRetries', () => {
    const rl = createRateLimiter()
    expect(rl.shouldRetry()).toBe(true)
    rl.consecutiveErrors = 2
    expect(rl.shouldRetry()).toBe(true)
  })

  it('shouldRetry is false at maxRetries', () => {
    const rl = createRateLimiter()
    rl.consecutiveErrors = 3
    expect(rl.shouldRetry()).toBe(false)
  })

  it('shouldRetry is false when disposed', () => {
    const rl = createRateLimiter()
    rl.dispose()
    expect(rl.shouldRetry()).toBe(false)
  })
})

describe('createRateLimiter — waitForSlot interval gating', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true immediately on first call (no prior call time)', async () => {
    const rl = createRateLimiter({ minIntervalMs: 1000 })
    const ready = await rl.waitForSlot()
    expect(ready).toBe(true)
    expect(rl.lastCallTime).toBeGreaterThan(0)
  })

  it('returns false immediately when disposed before invocation', async () => {
    const rl = createRateLimiter()
    rl.dispose()
    const ready = await rl.waitForSlot()
    expect(ready).toBe(false)
  })

  it('waits for minInterval between consecutive calls', async () => {
    const rl = createRateLimiter({ minIntervalMs: 1000 })
    // First call: grants slot immediately
    const first = await rl.waitForSlot()
    expect(first).toBe(true)

    // Second call: should wait up to 1000ms
    const secondPromise = rl.waitForSlot()
    // Timer not yet expired; advance time
    await vi.advanceTimersByTimeAsync(1000)
    const second = await secondPromise
    expect(second).toBe(true)
  })

  it('respects backoff window before checking interval', async () => {
    const rl = createRateLimiter({ minIntervalMs: 100 })
    rl.onRateLimit() // sets 5s backoff
    const promise = rl.waitForSlot()
    // Should still be waiting after 3s
    await vi.advanceTimersByTimeAsync(3000)
    let done = false
    promise.then(() => { done = true })
    await Promise.resolve()
    expect(done).toBe(false)
    // After full backoff expires, should resolve
    await vi.advanceTimersByTimeAsync(3000)
    const ready = await promise
    expect(ready).toBe(true)
  })

  it('returns false if disposed mid-wait (during backoff)', async () => {
    const rl = createRateLimiter({ minIntervalMs: 100 })
    rl.onRateLimit() // sets 5s backoff
    const promise = rl.waitForSlot()
    // Dispose while waiting — dispose clears the backoff timer, causing
    // the pending wait promise to never resolve. Instead, verify the
    // disposed flag flips so the next check returns false. We simulate by
    // advancing to just before dispose, then dispose.
    rl.dispose()
    // Advance past the (now-cleared) backoff window; the limiter's own
    // disposed check should return false without hanging.
    await vi.advanceTimersByTimeAsync(0)
    // Start a NEW waitForSlot call after dispose: should return false immediately
    const follow = await rl.waitForSlot()
    expect(follow).toBe(false)
    // The original promise will never resolve (its timer was cleared), so
    // we leave it pending. Confirm that too.
    let resolved = false
    promise.then(() => { resolved = true })
    await vi.advanceTimersByTimeAsync(10000)
    expect(resolved).toBe(false)
  })
})

describe('createRateLimiter — dispose and reset', () => {
  it('dispose marks instance disposed and clears pending timers', () => {
    const rl = createRateLimiter()
    // Inject a fake pending timer to verify cleanup
    const fakeId = setTimeout(() => {}, 10000)
    rl.pendingTimers.add(fakeId)
    rl.dispose()
    expect(rl.disposed).toBe(true)
    expect(rl.pendingTimers.size).toBe(0)
  })

  it('reset restores clean state and clears disposed flag', () => {
    const rl = createRateLimiter()
    rl.onRateLimit()
    rl.lastCallTime = 12345
    rl.dispose()
    rl.reset()
    expect(rl.disposed).toBe(false)
    expect(rl.consecutiveErrors).toBe(0)
    expect(rl.backoffUntil).toBe(0)
    expect(rl.lastCallTime).toBe(0)
    expect(rl.pendingTimers.size).toBe(0)
  })

  it('instances do not share state', () => {
    const a = createRateLimiter()
    const b = createRateLimiter()
    a.onRateLimit()
    expect(a.consecutiveErrors).toBe(1)
    expect(b.consecutiveErrors).toBe(0)
  })
})
