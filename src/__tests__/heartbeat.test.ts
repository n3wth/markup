import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../agent', () => ({
  askAgent: vi.fn(),
}))

import { askAgent } from '../agent'
import { generateObservation, resetHeartbeat } from '../heartbeat'

describe('generateObservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHeartbeat()
  })

  it('asks for a chat-only heartbeat observation', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    vi.mocked(askAgent).mockResolvedValueOnce({
      type: 'chat',
      chatMessage: 'The assumptions section is thin.',
    })

    const result = await generateObservation(
      'This is a real document with enough content to trigger the heartbeat observation path.',
      [{ from: 'You', text: 'Take a look.' }],
      'Aiden',
      'Technical writer',
      ['Nova'],
    )

    expect(result).toBe('The assumptions section is thin.')
    expect(askAgent).toHaveBeenCalledWith(expect.objectContaining({
      trigger: 'instruction',
      instruction: expect.stringContaining('chat only'),
    }))
  })

  it('dedupes repeated observations', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    vi.mocked(askAgent).mockResolvedValue({
      type: 'chat',
      chatMessage: 'The rollout plan is missing.',
    })

    const first = await generateObservation(
      'This is a real document with enough content to trigger the heartbeat observation path.',
      [],
      'Aiden',
      'Technical writer',
      ['Nova'],
    )
    const second = await generateObservation(
      'This is a real document with enough content to trigger the heartbeat observation path.',
      [],
      'Aiden',
      'Technical writer',
      ['Nova'],
    )

    expect(first).toBe('The rollout plan is missing.')
    expect(second).toBeNull()
  })
})
