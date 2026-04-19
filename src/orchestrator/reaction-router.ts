type AgentName = string

export interface ReactionRouterOptions {
  /** Initial agent roster (only used as a tie-breaker fallback when round-robin yields no candidate). */
  agents: ReadonlyArray<{ name: AgentName }>
}

/**
 * Public interface of the reaction router. The orchestrator composes this to
 * track which agent (if any) has a pending doc-edit reaction queued, and to
 * rotate round-robin through other agents for balanced participation after a
 * successful edit.
 *
 * The router owns only routing-order state (pendingReaction + roundRobin
 * index). Eligibility policy (exchange limits, turn limits, pause state)
 * remains in the orchestrator — this module purely answers "whose turn is it
 * to react next?" and "is someone already queued to react?".
 */
export interface ReactionRouter {
  /** The agent currently queued to react (or null). */
  getPending(): AgentName | null
  /** True when the given agent is currently the pending reactor. */
  isPending(agent: AgentName): boolean
  /** Mark an agent as the pending reactor. */
  setPending(agent: AgentName): void
  /** Clear the pending reactor slot. */
  clearPending(): void
  /**
   * If the pending reactor matches the given agent, clear it. Used when a
   * turn completes to release the slot only if it belonged to that agent.
   */
  clearPendingIf(agent: AgentName): void

  /**
   * Pick the next agent to react, rotating round-robin through `candidates`.
   * Returns `null` when the candidate list is empty (orchestrator should fall
   * back to its own defaulting). Advances the round-robin index on every call.
   */
  pickNextReactor(candidates: ReadonlyArray<AgentName>): AgentName | null

  /** Current round-robin index (exposed for testing and introspection). */
  getRoundRobinIndex(): number

  /** Reset every piece of state: clears pending and zeroes the round-robin index. */
  reset(): void
}

/**
 * Factory mirroring the `createRateLimiter` / `createTurnQueue` pattern:
 * returns a typed interface backed by closed-over state. No globals — each
 * orchestrator instance owns its own router.
 */
export function createReactionRouter(_options: ReactionRouterOptions): ReactionRouter {
  let pendingReaction: AgentName | null = null
  let roundRobin = 0

  return {
    getPending() {
      return pendingReaction
    },
    isPending(agent) {
      return pendingReaction === agent
    },
    setPending(agent) {
      pendingReaction = agent
    },
    clearPending() {
      pendingReaction = null
    },
    clearPendingIf(agent) {
      if (pendingReaction === agent) pendingReaction = null
    },

    pickNextReactor(candidates) {
      if (candidates.length === 0) return null
      const next = candidates[roundRobin % candidates.length]
      roundRobin++
      return next
    },

    getRoundRobinIndex() {
      return roundRobin
    },

    reset() {
      pendingReaction = null
      roundRobin = 0
    },
  }
}
