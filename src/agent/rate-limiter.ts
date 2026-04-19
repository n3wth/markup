// Client-side rate limiter: enforces minimum spacing between calls to stay within free tier limits.
// The server handles retries for transient errors via AI SDK's maxRetries.
// This limiter prevents the client from overwhelming the server with concurrent requests.

export interface RateLimiterOptions {
  /** Minimum interval between calls in ms. Defaults to 7000 (~8 RPM, safe under 10 RPM free tier). */
  minIntervalMs?: number
  /** Max consecutive errors before a longer cooldown. Defaults to 3. */
  maxRetries?: number
}

export interface RateLimiter {
  lastCallTime: number
  minIntervalMs: number
  backoffUntil: number
  consecutiveErrors: number
  maxRetries: number
  pendingTimers: Set<ReturnType<typeof setTimeout>>
  disposed: boolean
  waitForSlot(): Promise<boolean>
  onSuccess(): void
  onRateLimit(): void
  onError(): void
  shouldRetry(): boolean
  dispose(): void
  reset(): void
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  return {
    lastCallTime: 0,
    minIntervalMs: options.minIntervalMs ?? 7000,
    backoffUntil: 0,
    consecutiveErrors: 0,
    maxRetries: options.maxRetries ?? 3,
    pendingTimers: new Set<ReturnType<typeof setTimeout>>(),
    disposed: false,

    async waitForSlot(): Promise<boolean> {
      if (this.disposed) return false

      // If we're in backoff, check if it's expired
      if (Date.now() < this.backoffUntil) {
        const wait = this.backoffUntil - Date.now()
        if (import.meta.env.DEV) console.log(`[rate] backing off for ${Math.round(wait / 1000)}s`)
        await new Promise<void>((resolve) => {
          const id = setTimeout(() => { this.pendingTimers.delete(id); resolve() }, wait)
          this.pendingTimers.add(id)
        })
      }

      if (this.disposed) return false

      // Enforce minimum interval between calls
      const elapsed = Date.now() - this.lastCallTime
      if (elapsed < this.minIntervalMs) {
        await new Promise<void>((resolve) => {
          const id = setTimeout(() => { this.pendingTimers.delete(id); resolve() }, this.minIntervalMs - elapsed)
          this.pendingTimers.add(id)
        })
      }

      if (this.disposed) return false

      this.lastCallTime = Date.now()
      return true
    },

    onSuccess() {
      this.consecutiveErrors = 0
    },

    onRateLimit() {
      this.consecutiveErrors++
      const backoffSec = Math.min(60, 5 * Math.pow(2, this.consecutiveErrors - 1))
      this.backoffUntil = Date.now() + backoffSec * 1000
      console.warn(`[rate] 429 hit, backing off ${backoffSec}s (attempt ${this.consecutiveErrors})`)
    },

    onError() {
      this.consecutiveErrors++
      if (this.consecutiveErrors >= this.maxRetries) {
        this.backoffUntil = Date.now() + 30000
        console.warn('[rate] too many errors, cooling down 30s')
      }
    },

    shouldRetry(): boolean {
      return this.consecutiveErrors < this.maxRetries && !this.disposed
    },

    dispose() {
      this.disposed = true
      this.pendingTimers.forEach(id => clearTimeout(id))
      this.pendingTimers.clear()
    },

    reset() {
      this.pendingTimers.forEach(id => clearTimeout(id))
      this.pendingTimers.clear()
      this.disposed = false
      this.consecutiveErrors = 0
      this.backoffUntil = 0
      this.lastCallTime = 0
    },
  }
}
