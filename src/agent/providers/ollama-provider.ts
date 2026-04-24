// Ollama provider — adapter that calls the /api/ollama proxy.
//
// Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint.
// The proxy keeps the Ollama base URL server-configurable while allowing
// client-side override via X-Ollama-Url + X-Ollama-Model headers (BYOU/BYOM).
// Behavior mirrors gemini-provider: same error mapping, no rate limiting.

import { AgentError } from '../../agent'
import type { AskParams } from '../../agent'
import type { AgentProvider, AgentResponse } from '../provider'
import { buildPrompt } from '../../agent'

const DEFAULT_API_URL = '/api/ollama'

export interface OllamaProviderOptions {
  apiUrl?: string
  ollamaUrl?: string
  model?: string
}

export function createOllamaProvider(options: OllamaProviderOptions = {}): AgentProvider {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL

  async function generate(params: AskParams): Promise<AgentResponse> {
    const prompt = buildPrompt(params)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (options.ollamaUrl) headers['X-Ollama-Url'] = options.ollamaUrl
    if (options.model) headers['X-Ollama-Model'] = options.model

    const sessionMatch = typeof window !== 'undefined'
      ? window.location.pathname.match(/\/s\/([^/]+)/)
      : null
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

    const data = await res.json().catch(() => null) as {
      action?: unknown
      usage?: { input: number, output: number }
    } | null

    if (!data || !data.action || typeof data.action !== 'object') {
      throw new AgentError('Empty action from API', 'parse_error')
    }

    return {
      action: data.action as AgentResponse['action'],
      usage: data.usage,
    }
  }

  function dispose(): void {}

  return { generate, dispose }
}
