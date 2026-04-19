/**
 * Tracks recent edit activity as a decaying scalar in [0, 1] used to drive the
 * editor's background warmth gradient. Each `bump()` adds a small impulse; the
 * value decays exponentially toward 0 with the configured half-life. Read with
 * `value(now)` — decay is computed lazily so there is no internal timer.
 */

export interface WarmthTrackerConfig {
  /** Score added to `value` per bump. Clamped so the result stays <= 1. */
  bumpStrength?: number
  /** Time after which the score halves with no further bumps. */
  halfLifeMs?: number
}

export interface WarmthTracker {
  /** Register an edit. `now` defaults to `Date.now()` for testability. */
  bump(now?: number): void
  /** Current decayed value in [0, 1]. */
  value(now?: number): number
}

const DEFAULT_BUMP = 0.18
const DEFAULT_HALF_LIFE_MS = 15000

export function createWarmthTracker(config: WarmthTrackerConfig = {}): WarmthTracker {
  const bumpStrength = config.bumpStrength ?? DEFAULT_BUMP
  const halfLifeMs = config.halfLifeMs ?? DEFAULT_HALF_LIFE_MS
  // Exponential decay constant: value(t) = value0 * exp(-k * dt)
  // Pick k so that exp(-k * halfLifeMs) = 0.5  =>  k = ln(2) / halfLifeMs
  const k = Math.LN2 / halfLifeMs

  let score = 0
  let lastTs: number | null = null

  function decayed(now: number): number {
    if (lastTs === null) return 0
    const dt = Math.max(0, now - lastTs)
    return score * Math.exp(-k * dt)
  }

  return {
    bump(now = Date.now()) {
      const current = decayed(now)
      score = Math.min(1, current + bumpStrength)
      lastTs = now
    },
    value(now = Date.now()) {
      return decayed(now)
    },
  }
}
