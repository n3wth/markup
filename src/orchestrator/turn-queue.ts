import type { AgentAction, AskParams } from '../agent'

type AgentName = string

/**
 * A pending turn request held by the orchestrator's queue.
 * Matches the shape used by the orchestrator's dispatch loop.
 */
export interface TurnRequest {
  agent: AgentName
  trigger: AskParams['trigger']
  instruction?: string
  /** When true, this turn originated from the welcome/doc-opened flow and should not count toward the exchange limit */
  isInitial?: boolean
  /** User-approved doc mutation (skips LLM; runs through verifier with allowDirectDocEdit) */
  directAction?: AgentAction
}

export interface TurnQueueOptions {
  /** Initial agent roster used to seed per-agent turn counters. */
  agents: ReadonlyArray<{ name: AgentName }>
}

/**
 * Public interface of the turn queue. The orchestrator composes this to manage
 * queue state (pending turns), the processing mutex, per-agent turn counts,
 * and the inter-agent exchange counter.
 *
 * All behavior is identical to the prior inline implementation — this module
 * purely encapsulates state and helpers; policy (when to enqueue, when to skip,
 * analytics emission, pause logic) remains in the orchestrator.
 */
export interface TurnQueue {
  /** Push a request onto the tail of the queue. Returns new queue length. */
  push(req: TurnRequest): number
  /** Shift the next request from the head of the queue (undefined when empty). */
  shift(): TurnRequest | undefined
  /** Current queue depth. */
  size(): number
  /** Clear all pending requests. */
  clear(): void
  /** Remove every pending request belonging to an agent (used when pausing on failures). */
  removeAgent(agent: AgentName): void
  /** True when any pending request targets the given agent. */
  hasAgent(agent: AgentName): boolean

  /** Processing mutex — true while a turn is in-flight. */
  isProcessing(): boolean
  setProcessing(value: boolean): void

  /** Increment the per-agent turn counter. */
  incrementTurnCount(agent: AgentName): void
  /** Read the per-agent turn counter (0 for unknown agents). */
  getTurnCount(agent: AgentName): number
  /** Reset every known agent's turn counter to 0. */
  resetTurnCounts(): void
  /** Ensure an agent has a counter slot (initialized to 0 if absent). */
  ensureAgent(agent: AgentName): void

  /** Increment the back-and-forth exchange counter. */
  incrementExchange(): void
  /** Read the exchange counter. */
  getExchangeCount(): number
  /** Reset the exchange counter to 0. */
  resetExchangeCount(): void

  /** True when an agent has hit or passed the turn cap. */
  isTurnLimitReached(agent: AgentName, maxTurns: number): boolean
  /** True when exchanges have hit or passed the exchange cap. */
  isExchangeLimitReached(maxExchanges: number): boolean

  /**
   * Reset every piece of state: empties the queue, releases the processing flag,
   * zeroes turn counts, and resets the exchange counter. Intended for destroy().
   */
  reset(): void
}

/**
 * Factory mirroring the `createRateLimiter` pattern: returns a typed interface
 * backed by closed-over state. No globals, no singletons — each orchestrator
 * instance owns its own queue.
 */
export function createTurnQueue(options: TurnQueueOptions): TurnQueue {
  const queue: TurnRequest[] = []
  let processing = false
  let exchangeCount = 0
  const turnCount: Record<string, number> = Object.fromEntries(
    options.agents.map(a => [a.name, 0]),
  )

  return {
    push(req) {
      queue.push(req)
      return queue.length
    },
    shift() {
      return queue.shift()
    },
    size() {
      return queue.length
    },
    clear() {
      queue.length = 0
    },
    removeAgent(agent) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].agent === agent) queue.splice(i, 1)
      }
    },
    hasAgent(agent) {
      return queue.some(q => q.agent === agent)
    },

    isProcessing() {
      return processing
    },
    setProcessing(value) {
      processing = value
    },

    incrementTurnCount(agent) {
      turnCount[agent] = (turnCount[agent] ?? 0) + 1
    },
    getTurnCount(agent) {
      return turnCount[agent] ?? 0
    },
    resetTurnCounts() {
      for (const name of Object.keys(turnCount)) {
        turnCount[name] = 0
      }
    },
    ensureAgent(agent) {
      if (!(agent in turnCount)) turnCount[agent] = 0
    },

    incrementExchange() {
      exchangeCount++
    },
    getExchangeCount() {
      return exchangeCount
    },
    resetExchangeCount() {
      exchangeCount = 0
    },

    isTurnLimitReached(agent, maxTurns) {
      return (turnCount[agent] ?? 0) >= maxTurns
    },
    isExchangeLimitReached(maxExchanges) {
      return exchangeCount >= maxExchanges
    },

    reset() {
      queue.length = 0
      processing = false
      exchangeCount = 0
      for (const name of Object.keys(turnCount)) {
        turnCount[name] = 0
      }
    },
  }
}
