import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client before importing session-store. The client module
// reads import.meta.env at load; we don't need a real client, just one
// that captures .channel() + .send() + .on() calls.
interface ChannelStub {
  events: Array<{ kind: string; event?: string; cb: (p: unknown) => void }>
  sends: Array<{ type: string; event: string; payload: unknown }>
  subscribed: boolean
  on: (kind: string, arg1: unknown, cb: (p: unknown) => void) => ChannelStub
  subscribe: () => ChannelStub
  send: (msg: { type: string; event: string; payload: unknown }) => Promise<'ok'>
}

const channels: ChannelStub[] = []
const removedChannels: ChannelStub[] = []

function makeChannel(): ChannelStub {
  const ch: ChannelStub = {
    events: [],
    sends: [],
    subscribed: false,
    on(kind, arg1, cb) {
      // postgres_changes passes config obj as arg1; broadcast passes {event}
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
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn((ch: ChannelStub) => { removedChannels.push(ch) }),
  },
}))

import {
  publishDocumentEdit,
  subscribeToDocument,
  closeDocumentBroadcast,
} from '../lib/session-store'

beforeEach(() => {
  // Tear down any broadcast channels cached in the module under test so
  // each case starts from a clean slate. Uses known ids covered below.
  for (const id of ['s1', 's2', 'sx', 's-sub']) closeDocumentBroadcast(id)
  channels.length = 0
  removedChannels.length = 0
})

describe('publishDocumentEdit', () => {
  it('creates one broadcast channel per session and sends the payload', () => {
    publishDocumentEdit('s1', '<p>hello</p>')
    publishDocumentEdit('s1', '<p>hello world</p>')
    // One channel reused across sends for the same session.
    expect(channels.length).toBe(1)
    const ch = channels[0]
    expect(ch.subscribed).toBe(true)
    expect(ch.sends.length).toBe(2)
    expect(ch.sends[0]).toEqual({
      type: 'broadcast',
      event: 'doc-edit',
      payload: { html: '<p>hello</p>' },
    })
    expect(ch.sends[1].payload).toEqual({ html: '<p>hello world</p>' })
  })

  it('creates a separate channel per session id', () => {
    publishDocumentEdit('s1', '<p>a</p>')
    publishDocumentEdit('s2', '<p>b</p>')
    expect(channels.length).toBe(2)
  })
})

describe('closeDocumentBroadcast', () => {
  it('removes the cached channel so the next publish creates a fresh one', () => {
    publishDocumentEdit('sx', '<p>one</p>')
    expect(channels.length).toBe(1)
    closeDocumentBroadcast('sx')
    expect(removedChannels.length).toBe(1)
    publishDocumentEdit('sx', '<p>two</p>')
    expect(channels.length).toBe(2)
  })

  it('no-ops when the session has no cached channel', () => {
    expect(() => closeDocumentBroadcast('never-opened')).not.toThrow()
    expect(removedChannels.length).toBe(0)
  })
})

describe('subscribeToDocument', () => {
  it('listens for both postgres_changes and broadcast doc-edit events', () => {
    const onChange = vi.fn()
    subscribeToDocument('s-sub', onChange)
    const ch = channels[channels.length - 1]

    const kinds = ch.events.map(e => e.kind)
    expect(kinds).toContain('postgres_changes')
    expect(kinds).toContain('broadcast')
    const broadcast = ch.events.find(e => e.kind === 'broadcast')
    expect(broadcast?.event).toBe('doc-edit')
  })

  it('invokes onChange from the broadcast handler', () => {
    const onChange = vi.fn()
    subscribeToDocument('s-sub', onChange)
    const ch = channels[channels.length - 1]
    const handler = ch.events.find(e => e.kind === 'broadcast')!.cb
    handler({ payload: { html: '<p>live</p>' } })
    expect(onChange).toHaveBeenCalledWith('<p>live</p>')
  })

  it('invokes onChange from the postgres_changes handler', () => {
    const onChange = vi.fn()
    subscribeToDocument('s-sub', onChange)
    const ch = channels[channels.length - 1]
    const handler = ch.events.find(e => e.kind === 'postgres_changes')!.cb
    handler({ new: { html_snapshot: '<p>saved</p>' } })
    expect(onChange).toHaveBeenCalledWith('<p>saved</p>')
  })

  it('ignores broadcast payloads without html', () => {
    const onChange = vi.fn()
    subscribeToDocument('s-sub', onChange)
    const ch = channels[channels.length - 1]
    const handler = ch.events.find(e => e.kind === 'broadcast')!.cb
    handler({ payload: {} })
    handler({})
    expect(onChange).not.toHaveBeenCalled()
  })

  it('returns a cleanup function that removes the channel', () => {
    const unsub = subscribeToDocument('s-sub', vi.fn())
    unsub()
    expect(removedChannels.length).toBe(1)
  })
})
