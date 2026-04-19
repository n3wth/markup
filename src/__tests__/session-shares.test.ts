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
  delete: () => Builder
  eq: (col: string, val: unknown) => Builder
  order: (col: string, opts?: unknown) => Builder
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
    then(onFulfilled) {
      return Promise.resolve(result).then(onFulfilled)
    },
  }
  if (!builders[table]) builders[table] = []
  builders[table].push(b)
  return b
}

let nextResults: Record<string, { data: unknown; error: unknown }> = {}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const result = nextResults[table] ?? { data: [], error: null }
      return makeBuilder(table, result)
    }),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  },
}))

import { listShares, revokeShare } from '../lib/session-store'

beforeEach(() => {
  for (const k of Object.keys(builders)) delete builders[k]
  nextResults = {}
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
