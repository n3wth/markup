import { describe, it, expect } from 'vitest'
import { geminiRequestBodySchema } from '../../api/gemini'

describe('geminiRequestBodySchema', () => {
  it('accepts a valid prompt', () => {
    const result = geminiRequestBodySchema.safeParse({ prompt: 'hello' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.prompt).toBe('hello')
  })

  it('rejects missing prompt', () => {
    const result = geminiRequestBodySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-string prompt', () => {
    const result = geminiRequestBodySchema.safeParse({ prompt: 123 })
    expect(result.success).toBe(false)
  })

  it('rejects empty prompt', () => {
    const result = geminiRequestBodySchema.safeParse({ prompt: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/empty|length/i)
    }
  })

  it('rejects null body', () => {
    const result = geminiRequestBodySchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects a prompt over the length cap', () => {
    const huge = 'x'.repeat(200_001)
    const result = geminiRequestBodySchema.safeParse({ prompt: huge })
    expect(result.success).toBe(false)
  })

  it('accepts a prompt at exactly the length cap', () => {
    const atLimit = 'x'.repeat(200_000)
    const result = geminiRequestBodySchema.safeParse({ prompt: atLimit })
    expect(result.success).toBe(true)
  })
})
