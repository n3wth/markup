import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client before importing session-store. The client module
// reads import.meta.env at load; we don't need a real client, just one
// that captures .channel() + .send() + .on() calls.
interface ChannelStub {
  topic: string
  events: Array<{ kind: string; event?: string; cb: (p: unknown) => void }>
  sends: Array<{ type: string; event: string; payload: unknown }>
  subscribed: boolean
  on: (kind: string, arg1: unknown, cb: (p: unknown) => void) => ChannelStub
  subscribe: () => ChannelStub
  send: (msg: { type: string; event: string; payload: unknown }) => Promise<'ok'>
}

const channels: ChannelStub[] = []
const removedChannels: ChannelStub[] = []

function makeChannel(topic: string): ChannelStub {
  const ch: ChannelStub = {
    topic,
    events: [],
    sends: [],
    subscribed: false,
    on(kind, arg1, cb) {
      const event = (arg1 as { event?: string } | undefined)?.event
      ch.events.push({ kind, event, cb })
      return ch
    },
    subscribe() {
      ch.subscribed = true
      return ch
    },
    async send(msg) {
      ch.sends.push(msg)
      return 'ok'
    },
  }
  channels.push(ch)
  return ch
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn((topic: string) => makeChannel(topic)),
    removeChannel: vi.fn((ch: ChannelStub) => { removedChannels.push(ch) }),
  },
}))

import {
  publishPresence,
  subscribeToPresence,
  closePresenceBroadcast,
  type PresencePayload,
} from '../lib/session-store'

const samplePayload: PresencePayload = {
  userId: 'u1',
  name: 'Oliver',
  color: '#a78bfa',
  pos: 42,
  selectionFrom: 40,
  selectionTo: 42,
}

beforeEach(() => {
  for (const id of ['s1', 's2', 'sx', 's-sub']) closePresenceBroadcast(id)
  channels.length = 0
  removedChannels.length = 0
})

describe('publishPresence', () => {
  it('creates one broadcast channel per session and sends the payload', () => {
    publishPresence('s1', samplePayload)
    publishPresence('s1', { ...samplePayload, pos: 43 })
    expect(channels.length).toBe(1)
    const ch = channels[0]
    expect(ch.topic).toBe('presence-s1')
    expect(ch.subscribed).toBe(true)
    expect(ch.sends.length).toBe(2)
    expect(ch.sends[0]).toEqual({
      type: 'broadcast',
      event: 'presence',
      payload: samplePayload,
    })
    expect((ch.sends[1].payload as PresencePayload).pos).toBe(43)
  })

  it('creates a separate channel per session id', () => {
    publishPresence('s1', samplePayload)
    publishPresence('s2', samplePayload)
    expect(channels.length).toBe(2)
    expect(channels[0].topic).toBe('presence-s1')
    expect(channels[1].topic).toBe('presence-s2')
  })
})

describe('closePresenceBroadcast', () => {
  it('removes the cached channel so the next publish creates a fresh one', () => {
    publishPresence('sx', samplePayload)
    expect(channels.length).toBe(1)
    closePresenceBroadcast('sx')
    expect(removedChannels.length).toBe(1)
    publishPresence('sx', samplePayload)
    expect(channels.length).toBe(2)
  })

  it('no-ops when the session has no cached channel', () => {
    expect(() => closePresenceBroadcast('never-opened')).not.toThrow()
    expect(removedChannels.length).toBe(0)
  })
})

describe('subscribeToPresence', () => {
  it('listens on presence-{sessionId} for broadcast presence events', () => {
    subscribeToPresence('s-sub', vi.fn())
    const ch = channels[channels.length - 1]
    expect(ch.topic).toBe('presence-s-sub')
    const broadcast = ch.events.find(e => e.kind === 'broadcast')
    expect(broadcast?.event).toBe('presence')
  })

  it('invokes onPresence with the payload on broadcast', () => {
    const onPresence = vi.fn()
    subscribeToPresence('s-sub', onPresence)
    const ch = channels[channels.length - 1]
    const handler = ch.events.find(e => e.kind === 'broadcast')!.cb
    handler({ payload: samplePayload })
    expect(onPresence).toHaveBeenCalledWith(samplePayload)
  })

  it('ignores malformed payloads', () => {
    const onPresence = vi.fn()
    subscribeToPresence('s-sub', onPresence)
    const ch = channels[channels.length - 1]
    const handler = ch.events.find(e => e.kind === 'broadcast')!.cb
    handler({ payload: {} })
    handler({ payload: { userId: 'u1' } }) // missing pos
    handler({ payload: { pos: 10 } })      // missing userId
    handler({})
    expect(onPresence).not.toHaveBeenCalled()
  })

  it('returns a cleanup function that removes the channel', () => {
    const unsub = subscribeToPresence('s-sub', vi.fn())
    unsub()
    expect(removedChannels.length).toBe(1)
  })
})
