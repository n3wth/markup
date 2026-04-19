import { describe, it, expect } from 'vitest'
import { createWarmthTracker } from '../lib/warmth-tracker'

describe('createWarmthTracker', () => {
  it('starts at zero with no bumps', () => {
    const t = createWarmthTracker()
    expect(t.value(1000)).toBe(0)
  })

  it('bump raises the value by bumpStrength', () => {
    const t = createWarmthTracker({ bumpStrength: 0.2, halfLifeMs: 10000 })
    t.bump(0)
    expect(t.value(0)).toBeCloseTo(0.2, 5)
  })

  it('value decays toward zero between bumps', () => {
    const t = createWarmthTracker({ bumpStrength: 0.5, halfLifeMs: 1000 })
    t.bump(0)
    expect(t.value(0)).toBeCloseTo(0.5, 5)
    expect(t.value(1000)).toBeCloseTo(0.25, 5)
    expect(t.value(2000)).toBeCloseTo(0.125, 5)
  })

  it('successive bumps accumulate but clamp at 1', () => {
    const t = createWarmthTracker({ bumpStrength: 0.4, halfLifeMs: 100000 })
    t.bump(0)
    t.bump(1)
    t.bump(2)
    t.bump(3)
    t.bump(4)
    // Five 0.4 bumps with negligible decay would sum to 2.0; must clamp to 1.
    expect(t.value(4)).toBeLessThanOrEqual(1)
    expect(t.value(4)).toBeGreaterThan(0.9)
  })

  it('bump after long quiet period does not stack on stale value', () => {
    const t = createWarmthTracker({ bumpStrength: 0.3, halfLifeMs: 1000 })
    t.bump(0)
    // 10 half-lives later, prior contribution is ~0.001 — bump reads from
    // decayed base, not the original score.
    t.bump(10000)
    const v = t.value(10000)
    expect(v).toBeGreaterThan(0.299)
    expect(v).toBeLessThan(0.302)
  })

  it('halfLifeMs controls the decay rate', () => {
    const fast = createWarmthTracker({ bumpStrength: 1, halfLifeMs: 500 })
    const slow = createWarmthTracker({ bumpStrength: 1, halfLifeMs: 5000 })
    fast.bump(0)
    slow.bump(0)
    expect(fast.value(500)).toBeCloseTo(0.5, 5)
    expect(slow.value(500)).toBeGreaterThan(0.9)
  })

  it('value never goes negative', () => {
    const t = createWarmthTracker()
    t.bump(0)
    expect(t.value(1_000_000)).toBeGreaterThanOrEqual(0)
  })
})
