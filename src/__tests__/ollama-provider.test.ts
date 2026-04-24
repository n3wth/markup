import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/api-key-cache', () => ({
  getStoredApiKey: vi.fn(() => null),
}))

vi.stubGlobal('window', {
  location: { pathname: '/s/ollama-test-session' },
})

import { createOllamaProvider } from '../agent/providers/ollama-provider'
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

describe('AgentProvider contract — ollama adapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let provider: AgentProvider

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    provider = createOllamaProvider({ ollamaUrl: 'http://localhost:11434', model: 'llama3.2' })
  })

  afterEach(() => {
    provider.dispose()
    vi.restoreAllMocks()
  })

  describe('shape', () => {
    it('createOllamaProvider returns generate and dispose', () => {
      expect(typeof provider.generate).toBe('function')
      expect(typeof provider.dispose).toBe('function')
    })

    it('generate resolves to { action, usage? }', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          action: { type: 'chat', chatMessage: 'hello' },
          usage: { input: 8, output: 4 },
        }),
      })

      const result: AgentResponse = await provider.generate(makeParams())
      expect(result.action.type).toBe('chat')
      expect(result.usage).toEqual({ input: 8, output: 4 })
    })

    it('dispose is idempotent', () => {
      expect(provider.dispose()).toBeUndefined()
      expect(provider.dispose()).toBeUndefined()
    })
  })

  describe('transport behavior', () => {
    it('POSTs to /api/ollama with a prompt string body', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await provider.generate(makeParams())

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('/api/ollama')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body)
      expect(body).toHaveProperty('prompt')
      expect(typeof body.prompt).toBe('string')
    })

    it('attaches X-Ollama-Url, X-Ollama-Model, X-Session-Id headers', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await provider.generate(makeParams({ agentName: 'Nova' }))

      const headers = fetchSpy.mock.calls[0][1].headers
      expect(headers['X-Ollama-Url']).toBe('http://localhost:11434')
      expect(headers['X-Ollama-Model']).toBe('llama3.2')
      expect(headers['X-Session-Id']).toBe('ollama-test-session')
      expect(headers['X-Agent-Name']).toBe('Nova')
    })

    it('honors custom apiUrl option', async () => {
      const custom = createOllamaProvider({ apiUrl: '/api/custom-ollama' })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await custom.generate(makeParams())
      expect(fetchSpy.mock.calls[0][0]).toBe('/api/custom-ollama')
      custom.dispose()
    })

    it('omits provider headers when not configured', async () => {
      const bare = createOllamaProvider()
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      await bare.generate(makeParams())
      const headers = fetchSpy.mock.calls[0][1].headers
      expect(headers['X-Ollama-Url']).toBeUndefined()
      expect(headers['X-Ollama-Model']).toBeUndefined()
      bare.dispose()
    })
  })

  describe('error mapping', () => {
    it('throws AgentError with rate_limit code on 429', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })

      await expect(provider.generate(makeParams())).rejects.toMatchObject({
        name: 'AgentError',
        code: 'rate_limit',
        status: 429,
        retryable: true,
      })
    })

    it('throws AgentError with api_error on non-2xx/429', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: 'service unavailable' }) })

      const err = await provider.generate(makeParams()).catch(e => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('api_error')
      expect((err as AgentError).status).toBe(503)
    })

    it('throws AgentError with parse_error on missing action', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ action: null }) })

      const err = await provider.generate(makeParams()).catch(e => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('parse_error')
    })

    it('throws AgentError with network_error on fetch failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const err = await provider.generate(makeParams()).catch(e => e)
      expect(err).toBeInstanceOf(AgentError)
      expect((err as AgentError).code).toBe('network_error')
      expect((err as AgentError).retryable).toBe(true)
    })
  })

  describe('seam isolation', () => {
    it('does not apply rate limiting — caller owns that', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ action: { type: 'chat', chatMessage: 'ok' } }),
      })

      const start = Date.now()
      await provider.generate(makeParams())
      await provider.generate(makeParams())
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(1000)
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })
})
