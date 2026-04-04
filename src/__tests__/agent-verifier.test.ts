import { describe, it, expect } from 'vitest'
import { verifyAndNormalizeAction } from '../agent-verifier'
import type { AgentAction } from '../agent'

describe('verifyAndNormalizeAction', () => {
  it('converts insert to propose_edit when not direct', () => {
    const a: AgentAction = {
      type: 'insert',
      position: 'end',
      content: 'Hello',
      chatBefore: 'Adding',
    }
    const out = verifyAndNormalizeAction(a, { allowDirectDocEdit: false })
    expect(out.type).toBe('propose_edit')
    expect(out.editKind).toBe('insert')
    expect(out.afterText).toContain('Hello')
  })

  it('keeps insert when direct apply', () => {
    const a: AgentAction = {
      type: 'insert',
      position: 'end',
      content: 'Hello',
      chatBefore: 'Adding',
    }
    const out = verifyAndNormalizeAction(a, { allowDirectDocEdit: true })
    expect(out.type).toBe('insert')
    expect(out.content).toBe('Hello')
  })
})
