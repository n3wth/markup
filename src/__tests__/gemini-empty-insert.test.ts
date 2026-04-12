import { describe, expect, it } from 'vitest'
import { normalizeGeminiAction } from '../../api/gemini-normalize'

describe('normalizeGeminiAction empty insert recovery', () => {
  it('recovers insert content from thought when Gemini puts the document text there', () => {
    const action = normalizeGeminiAction({
      type: 'insert',
      position: 'end',
      content: '',
      thought: 'Add a short migration note for users upgrading from the beta build.',
    })

    expect(action.content).toBe('Add a short migration note for users upgrading from the beta build.')
    expect(action.thought).toBe('Add a short migration')
  })

  it('rejects insert actions that are still empty after normalization', () => {
    expect(() => normalizeGeminiAction({
      type: 'insert',
      position: 'end',
      content: '',
      thought: 'adding intro',
    })).toThrow('Insert action missing content after normalization')
  })
})
