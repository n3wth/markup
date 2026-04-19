// Gemini provider — adapter that wraps the existing /api/gemini proxy call.
//
// Extracted from agent.ts so Wave 2/3 can add Claude + OpenAI providers by
// implementing AgentProvider without touching askAgent's orchestration.
// Behavior is byte-identical to the pre-seam implementation: same URL, same
// headers, same request body shape, same error mapping.

import { AgentError } from '../../agent'
import type { AskParams } from '../../agent'
import type { AgentProvider, AgentResponse } from '../provider'
import { getStoredApiKey } from '../../lib/api-key-cache'
import { buildPrompt } from '../../agent'

const DEFAULT_API_URL = '/api/gemini'

export interface GeminiProviderOptions {
  /** Override the proxy URL. Defaults to `/api/gemini`. */
  apiUrl?: string
}

/**
 * Creates a Gemini-backed AgentProvider. The adapter is stateless beyond the
 * fetch call itself — rate limiting, prompt assembly, and action validation
 * remain in askAgent for provider-neutral reuse.
 */
export function createGeminiProvider(options: GeminiProviderOptions = {}): AgentProvider {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL

  async function generate(params: AskParams): Promise<AgentResponse> {
    const prompt = buildPrompt(params)
    const clientKey = getStoredApiKey()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientKey) headers['X-Gemini-Key'] = clientKey
    // Pass session context for server-side tracing
    const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
    if (sessionMatch) headers['X-Session-Id'] = sessionMatch[1]
    if (params.agentName) headers['X-Agent-Name'] = params.agentName

    let res: Response
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      })
    } catch (err) {
      throw new AgentError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        'network_error',
        undefined,
        true,
      )
    }

    if (res.status === 429) {
      throw new AgentError('Rate limit exceeded', 'rate_limit', 429, true)
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as { error?: string }))
      throw new AgentError(
        errBody.error || `API error ${res.status}`,
        'api_error',
        res.status,
      )
    }

    const data = await res.json().catch(() => null) as { action?: unknown, usage?: { input: number, output: number } } | null
    if (!data || !data.action || typeof data.action !== 'object') {
      throw new AgentError('Empty action from API', 'parse_error')
    }

    return {
      action: data.action as AgentResponse['action'],
      usage: data.usage,
    }
  }

  function dispose(): void {
    // No persistent resources to release; fetch calls complete synchronously
    // from the caller's perspective and the rate limiter handles its own timers.
  }

  return { generate, dispose }
}
