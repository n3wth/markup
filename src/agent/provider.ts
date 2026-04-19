// AgentProvider — minimal seam for swapping the LLM transport.
//
// This interface intentionally stays narrow: it covers only the provider-specific
// request (prompt in, action out). Rate limiting, prompt assembly, validation,
// and response post-processing stay in agent.ts so they are shared across all
// providers. Wave 2/3 add Claude + OpenAI adapters by implementing this interface;
// askAgent itself does not change shape.

import type { AskParams, AgentAction } from '../agent'

export type { AskParams, AgentAction }

/**
 * Response returned by an AgentProvider after a successful generate() call.
 *
 * `action` is the raw parsed action object from the provider's JSON response.
 * Callers (agent.ts) run validation + normalization; providers should not
 * mutate the action beyond parsing the transport envelope.
 *
 * `usage` is optional token accounting. Shape matches the existing
 * `/api/gemini` response body (`{ input, output }`) to preserve the current
 * contract; other providers may populate the same keys or leave undefined.
 */
export interface AgentResponse {
  action: AgentAction
  usage?: { input: number, output: number }
}

/**
 * AgentProvider — the transport seam. One implementation per LLM backend.
 *
 * Contract:
 * - `generate(params)` returns the parsed AgentResponse for the given AskParams.
 * - Implementations throw `AgentError` (from agent.ts) with a code that matches
 *   the failure mode: `rate_limit` for HTTP 429, `api_error` for other non-2xx,
 *   `parse_error` for malformed bodies, `network_error` for transport failures.
 * - `dispose()` releases any in-flight timers or connections. Idempotent.
 *
 * Providers must NOT handle rate-limiting, validation, or prompt construction;
 * those stay in askAgent.
 */
export interface AgentProvider {
  generate(params: AskParams): Promise<AgentResponse>
  dispose(): void
}
