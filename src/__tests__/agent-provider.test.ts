import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the api key cache before importing provider code (same pattern as agent-api.test.ts)
vi.mock('../lib/api-key-cache', () => ({
  getStoredApiKey: vi.fn(() => null),
}))

// Mock window.location for session ID extraction
vi.stubGlobal('window', {
  location: { pathname: '/s/provider-test-session' },
})

import { createGeminiProvider } from '../agent/providers/gemini-provider'
import type { AgentProvider, AgentResponse } from '../agent/provider'
import { AgentError, type AskParams } from '../agent'

function makeParams(overrides?: Partial<AskParams>): AskParams {
  return {
    agentName: 'Aiden',
    ownerName: 'Oliver',
    docText: 'Test document',
    chatHistory: [],
    trigger: 'instruction',
    instruction: 'add detail',
    persona: 'Test persona',
    otherAgents: ['Nova'],
    ...overrides,
  }
}

describe('AgentProvider contract — gemini adapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let provider: AgentProvider

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    provider = createGeminiProvider()
  })

  afterEach(() => {
    provider.dispose()
    vi.restoreAllMocks()
  })

  describe('shape', () => {
    it('createGeminiProvider returns an object with generate and dispose', () => {
      expect(typeof provider.generate).toBe('function')
      expect(typeof provider.dispose).toBe('function')
    })

    it('generate resolves to { action, usage? }', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          action: { type: 'chat', chatMessage: 'hi' },
          usage: { input: 10, output: 5 },
        }),
      })

      const result: AgentResponse = await provider.generate(makeParams())
      expect(result).toHaveProperty('action')
      expect(result.action.type).toBe('chat')
      expect(result.usage).toEqual({ input: 10, output: 5 })
    })

    it('dispose is idempotent and returns void', () => {
      expect(provider.dispose()).toBeUndefined()
      expect(provider.dispose()).toBeUndefined()
    })
  })

  describe('transport behavior', () => {
    it('POSTs to /api/gemini with a prompt string body', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await provider.generate(makeParams())

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('/api/gemini')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body)
      expect(body).toHaveProperty('prompt')
      expect(typeof body.prompt).toBe('string')
      // Payload shape guard — should NOT leak provider-specific fields to server
      expect(body).not.toHaveProperty('contents')
      expect(body).not.toHaveProperty('generationConfig')
    })

    it('attaches X-Session-Id and X-Agent-Name headers', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await provider.generate(makeParams({ agentName: 'Nova' }))

      const headers = fetchSpy.mock.calls[0][1].headers
      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['X-Session-Id']).toBe('provider-test-session')
      expect(headers['X-Agent-Name']).toBe('Nova')
    })

    it('honors custom apiUrl option', async () => {
      const custom = createGeminiProvider({ apiUrl: '/api/custom-gemini' })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await custom.generate(makeParams())
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/custom-gemini')
      custom.dispose()
    })
  })

  describe('error mapping', () => {
    it('throws AgentError with rate_limit code on 429', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'rate limited' }),
      })

      await expect(provider.generate(makeParams())).rejects.toMatchObject({
        name: 'AgentError',
        code: 'rate_limit',
        status: 429,
        retryable: true,
      })
    })

    it('throws AgentError with api_error code on non-2xx/429', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'server boom' }),
      })

      const err = await provider.generate(makeParams()).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('api_error')
      expect((err as AgentError).status).toBe(500)
      expect((err as AgentError).message).toContain('server boom')
    })

    it('throws AgentError with parse_error on empty/missing action', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: null }),
      })

      const err = await provider.generate(makeParams()).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('parse_error')
    })

    it('throws AgentError with network_error on fetch failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const err = await provider.generate(makeParams()).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('network_error')
      expect((err as AgentError).retryable).toBe(true)
    })
  })

  describe('seam isolation', () => {
    it('does not apply rate limiting itself — caller owns that', async () => {
      // Two back-to-back calls should not be delayed by the provider.
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      const start = Date.now()
      await provider.generate(makeParams())
      await provider.generate(makeParams())
      const elapsed = Date.now() - start

      // Rate limiter in agent.ts enforces 7s; provider must not.
      expect(elapsed).toBeLessThan(1000)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('returns action unmodified — caller owns validation + trimming', async () => {
      const rawAction = {
        type: 'insert',
        content: 'text',
        position: 'end',
        thought: 'this thought is way too long and should be trimmed by caller',
        reasoning: ['step 1', 'step 2', 'step 3', 'step 4'],
      }
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: rawAction }),
      })

      const { action } = await provider.generate(makeParams())
      // Provider returns as-is; it's askAgent that trims.
      expect(action.thought).toBe(rawAction.thought)
      expect(action.reasoning).toHaveLength(4)
    })
  })
})
