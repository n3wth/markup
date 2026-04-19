import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client before importing session-store. We capture
// .from(table).delete().eq(col, val) and .from(table).select().eq()
// .order() call chains as plain arrays so we can assert on them.

interface BuilderCall {
  op: string
  args: unknown[]
}

interface Builder {
  calls: BuilderCall[]
  // result of the terminal await on the chain
  result: { data: unknown; error: unknown }
  select: (cols?: string) => Builder
  insert: (row: unknown) => Builder
  delete: () => Builder
  eq: (col: string, val: unknown) => Builder
  order: (col: string, opts?: unknown) => Builder
  single: () => Builder
  // make the builder thenable so `await builder` resolves to `result`
  then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>
}

const builders: Record<string, Builder[]> = {}

function makeBuilder(table: string, result: { data: unknown; error: unknown }): Builder {
  const calls: BuilderCall[] = []
  const b: Builder = {
    calls,
    result,
    select(cols) {
      calls.push({ op: 'select', args: [cols] })
      return b
    },
    insert(row) {
      calls.push({ op: 'insert', args: [row] })
      return b
    },
    delete() {
      calls.push({ op: 'delete', args: [] })
      return b
    },
    eq(col, val) {
      calls.push({ op: 'eq', args: [col, val] })
      return b
    },
    order(col, opts) {
      calls.push({ op: 'order', args: [col, opts] })
      return b
    },
    single() {
      calls.push({ op: 'single', args: [] })
      return b
    },
    then(onFulfilled) {
      return Promise.resolve(result).then(onFulfilled)
    },
  }
  if (!builders[table]) builders[table] = []
  builders[table].push(b)
  return b
}

let nextResults: Record<string, { data: unknown; error: unknown }> = {}
const rpcCalls: { name: string; args: unknown }[] = []
let nextRpcResult: { data: unknown; error: unknown } = { data: null, error: null }

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const result = nextResults[table] ?? { data: [], error: null }
      return makeBuilder(table, result)
    }),
    rpc: vi.fn(async (name: string, args: unknown) => {
      rpcCalls.push({ name, args })
      return nextRpcResult
    }),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}))

import {
  createShareByEmail,
  createShareLink,
  generateShareToken,
  listShares,
  logShareEvent,
  resolveShareLink,
  revokeShare,
} from '../lib/session-store'

beforeEach(() => {
  for (const k of Object.keys(builders)) delete builders[k]
  nextResults = {}
  rpcCalls.length = 0
  nextRpcResult = { data: null, error: null }
})

describe('listShares', () => {
  it('selects from session_shares filtered by session_id, ordered by created_at', async () => {
    nextResults['session_shares'] = {
      data: [
        {
          id: 'sh-1',
          session_id: 's-1',
          principal_type: 'email',
          principal: 'alice@example.com',
          role: 'viewer',
          expires_at: null,
          created_at: '2026-04-19T00:00:00Z',
        },
      ],
      error: null,
    }

    const result = await listShares('s-1')

    expect(result).toHaveLength(1)
    expect(result[0].principal).toBe('alice@example.com')
    expect(result[0].role).toBe('viewer')

    const b = builders['session_shares'][0]
    expect(b.calls).toEqual([
      { op: 'select', args: ['*'] },
      { op: 'eq', args: ['session_id', 's-1'] },
      { op: 'order', args: ['created_at', { ascending: true }] },
    ])
  })

  it('returns [] when the table is empty', async () => {
    nextResults['session_shares'] = { data: [], error: null }
    const result = await listShares('s-empty')
    expect(result).toEqual([])
  })

  it('throws when supabase returns an error', async () => {
    nextResults['session_shares'] = { data: null, error: new Error('rls denied') }
    await expect(listShares('s-1')).rejects.toThrow('rls denied')
  })
})

describe('revokeShare', () => {
  it('deletes the share row by id', async () => {
    nextResults['session_shares'] = { data: null, error: null }

    await revokeShare('sh-abc')

    const b = builders['session_shares'][0]
    expect(b.calls).toEqual([
      { op: 'delete', args: [] },
      { op: 'eq', args: ['id', 'sh-abc'] },
    ])
  })

  it('throws when delete fails (e.g. non-owner blocked by RLS)', async () => {
    nextResults['session_shares'] = {
      data: null,
      error: new Error('permission denied'),
    }
    await expect(revokeShare('sh-abc')).rejects.toThrow('permission denied')
  })

  it('issues exactly one delete per call (no batching surprises)', async () => {
    nextResults['session_shares'] = { data: null, error: null }
    await revokeShare('sh-1')
    await revokeShare('sh-2')

    expect(builders['session_shares']).toHaveLength(2)
    expect(builders['session_shares'][0].calls[1]).toEqual({
      op: 'eq',
      args: ['id', 'sh-1'],
    })
    expect(builders['session_shares'][1].calls[1]).toEqual({
      op: 'eq',
      args: ['id', 'sh-2'],
    })
  })
})

describe('generateShareToken', () => {
  it('produces URL-safe base64 without padding', () => {
    const token = generateShareToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.includes('=')).toBe(false)
  })

  it('is unique across consecutive calls', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(a).not.toEqual(b)
  })

  it('is long enough to resist guessing (>= 32 chars)', () => {
    expect(generateShareToken().length).toBeGreaterThanOrEqual(32)
  })
})

describe('createShareLink', () => {
  it('inserts a token-principal share with the requested role', async () => {
    nextResults['session_shares'] = {
      data: {
        id: 'sh-new',
        session_id: 's-1',
        principal_type: 'token',
        principal: 'tok-xyz',
        role: 'viewer',
        expires_at: null,
        created_at: '2026-04-19T00:00:00Z',
      },
      error: null,
    }

    const share = await createShareLink('s-1', 'viewer')

    expect(share.id).toBe('sh-new')
    expect(share.role).toBe('viewer')

    const b = builders['session_shares'][0]
    const insertCall = b.calls.find(c => c.op === 'insert')
    expect(insertCall).toBeDefined()
    const row = (insertCall!.args[0] as Record<string, unknown>)
    expect(row.session_id).toBe('s-1')
    expect(row.principal_type).toBe('token')
    expect(row.role).toBe('viewer')
    // The token is generated inside the function; just make sure it's present.
    expect(typeof row.principal).toBe('string')
    expect((row.principal as string).length).toBeGreaterThan(20)
  })

  it('propagates insert errors (e.g. RLS denial on non-owner)', async () => {
    nextResults['session_shares'] = {
      data: null,
      error: new Error('new row violates row-level security'),
    }
    await expect(createShareLink('s-1', 'viewer'))
      .rejects.toThrow(/row-level security/)
  })
})

describe('createShareByEmail', () => {
  it('normalises email to lowercase trimmed and inserts email-principal row', async () => {
    nextResults['session_shares'] = {
      data: {
        id: 'sh-email',
        session_id: 's-1',
        principal_type: 'email',
        principal: 'alice@example.com',
        role: 'editor',
        expires_at: null,
        created_at: '2026-04-19T00:00:00Z',
      },
      error: null,
    }

    await createShareByEmail('s-1', '  ALICE@Example.COM  ', 'editor')

    const b = builders['session_shares'][0]
    const row = (b.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>)
    expect(row.principal).toBe('alice@example.com')
    expect(row.principal_type).toBe('email')
    expect(row.role).toBe('editor')
  })
})

describe('logShareEvent', () => {
  it('inserts into share_events with the share id and swallows errors', async () => {
    nextResults['share_events'] = { data: null, error: null }
    await logShareEvent('sh-1')
    const b = builders['share_events'][0]
    const row = (b.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>)
    expect(row.share_id).toBe('sh-1')
  })

  it('does not throw when supabase returns an error', async () => {
    nextResults['share_events'] = { data: null, error: new Error('offline') }
    // A dropped analytics row must never block the viewer.
    await expect(logShareEvent('sh-1')).resolves.toBeUndefined()
  })
})

describe('resolveShareLink', () => {
  it('calls the RPC with the token and maps the row', async () => {
    nextRpcResult = {
      data: [
        {
          share_id: 'sh-1',
          session_id: 's-1',
          role: 'viewer',
          session_title: 'My doc',
          session_template: 'blank',
          document_html: '<p>hi</p>',
          document_updated_at: '2026-04-19T00:00:00Z',
        },
      ],
      error: null,
    }
    const resolved = await resolveShareLink('tok-abc')
    expect(resolved?.sessionId).toBe('s-1')
    expect(resolved?.role).toBe('viewer')
    expect(resolved?.documentHtml).toBe('<p>hi</p>')
    expect(rpcCalls[0]).toEqual({ name: 'resolve_share_link', args: { token: 'tok-abc' } })
  })

  it('returns null on empty RPC result (token unknown, revoked, expired — indistinguishable)', async () => {
    nextRpcResult = { data: [], error: null }
    expect(await resolveShareLink('bad')).toBeNull()
  })

  it('returns null and does not throw when the RPC errors', async () => {
    nextRpcResult = { data: null, error: new Error('boom') }
    expect(await resolveShareLink('tok')).toBeNull()
  })
})
