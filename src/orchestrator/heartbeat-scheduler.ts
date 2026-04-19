/**
 * Heartbeat scheduler — owns timer scheduling, tracking, and the heartbeat
 * lifecycle for the orchestrator.
 *
 * Responsibilities:
 *  - wrap `window.setTimeout` so every scheduled callback is tracked and can be
 *    cancelled en masse on destroy / user-message / pause
 *  - schedule a repeating heartbeat timer with a randomized min-max delay
 *  - call an injected `fire` callback when the heartbeat elapses; the caller
 *    is responsible for heartbeat business logic (observation generation,
 *    reading orchestrator state, deciding what to do next) and for calling
 *    `startHeartbeat()` again to reschedule
 *
 * Mirrors the factory pattern established by `createTurnQueue`
 * (src/orchestrator/turn-queue.ts) and `createRateLimiter` (planned).
 */

export interface HeartbeatSchedulerOptions {
  /** Min/max delay (inclusive) for the random heartbeat interval, in ms. */
  heartbeatDelayMs: [number, number]
  /** When true, use the shorter demo-mode heartbeat range (8-12s). */
  demoMode?: boolean
  /** Callback invoked when the heartbeat timer fires. */
  fire: () => void | Promise<void>
}

export interface HeartbeatScheduler {
  /**
   * Schedule a callback to run after `delayMs`. Returns the timer id.
   * Callbacks do not fire if `destroy()` has been called before they elapse.
   * The timer is automatically untracked when it fires.
   */
  schedule(cb: () => void, delayMs: number): number
  /** Cancel every tracked timer (including the heartbeat, if any). */
  clearAll(): void
  /** Schedule the next heartbeat. Cancels any prior heartbeat first. */
  startHeartbeat(): void
  /** Cancel the pending heartbeat (no-op if none). */
  stopHeartbeat(): void
  /** Stop the heartbeat, clear all tracked timers, and refuse further schedules. */
  destroy(): void
}

export function createHeartbeatScheduler(options: HeartbeatSchedulerOptions): HeartbeatScheduler {
  const { heartbeatDelayMs, demoMode, fire } = options
  const scheduledTimers = new Set<number>()
  let heartbeatTimer: number | null = null
  let destroyed = false

  function schedule(cb: () => void, delayMs: number): number {
    if (destroyed) return 0
    const id = window.setTimeout(() => {
      scheduledTimers.delete(id)
      if (!destroyed) cb()
    }, delayMs)
    scheduledTimers.add(id)
    return id
  }

  function clearAll(): void {
    scheduledTimers.forEach(id => clearTimeout(id))
    scheduledTimers.clear()
    heartbeatTimer = null
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer !== null) {
      clearTimeout(heartbeatTimer)
      scheduledTimers.delete(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function startHeartbeat(): void {
    if (destroyed) return
    stopHeartbeat()
    const [hbMin, hbMax] = heartbeatDelayMs
    const delay = demoMode
      ? 8000 + Math.random() * 4000
      : hbMin + Math.random() * (hbMax - hbMin)
    heartbeatTimer = schedule(() => {
      heartbeatTimer = null
      void fire()
    }, delay)
  }

  function destroy(): void {
    destroyed = true
    clearAll()
  }

  return { schedule, clearAll, startHeartbeat, stopHeartbeat, destroy }
}
