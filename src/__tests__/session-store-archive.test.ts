import { describe, it, expect, vi, beforeEach } from 'vitest'

interface BuilderCall {
  op: string
  args: unknown[]
}

interface Builder {
  calls: BuilderCall[]
  result: { data: unknown; error: unknown }
  select: (cols?: string) => Builder
  insert: (row: unknown) => Builder
  update: (row: unknown) => Builder
  eq: (col: string, val: unknown) => Builder
  order: (col: string, opts?: unknown) => Builder
  limit: (n: number) => Builder
  single: () => Builder
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
    update(row) {
      calls.push({ op: 'update', args: [row] })
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
    limit(n) {
      calls.push({ op: 'limit', args: [n] })
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

import {
  listSessions,
  archiveSession,
  restoreSession,
  restoreProject,
} from '../lib/session-store'

beforeEach(() => {
  for (const k of Object.keys(builders)) delete builders[k]
  nextResults = {}
})

describe('listSessions', () => {
  it('orders by archived_at (nulls first) then updated_at desc, limit 20', async () => {
    const now = '2026-04-19T00:00:00Z'
    nextResults['sessions'] = {
      data: [
        { id: 's-1', user_id: 'u-1', title: 'Live', template: 'blank', archived_at: null, created_at: now, updated_at: now },
        { id: 's-2', user_id: 'u-1', title: 'Old', template: 'blank', archived_at: now, created_at: now, updated_at: now },
      ],
      error: null,
    }

    const result = await listSessions()

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Live')

    const b = builders['sessions'][0]
    expect(b.calls).toEqual([
      { op: 'select', args: ['*'] },
      { op: 'order', args: ['archived_at', { ascending: true, nullsFirst: true }] },
      { op: 'order', args: ['updated_at', { ascending: false }] },
      { op: 'limit', args: [20] },
    ])
  })
})

describe('archiveSession', () => {
  it('stamps archived_at and filters by id', async () => {
    nextResults['sessions'] = { data: null, error: null }
    await archiveSession('s-1')
    const b = builders['sessions'][0]
    expect(b.calls).toHaveLength(2)
    expect(b.calls[0].op).toBe('update')
    const updateArg = b.calls[0].args[0] as { archived_at: string }
    expect(typeof updateArg.archived_at).toBe('string')
    expect(Number.isNaN(Date.parse(updateArg.archived_at))).toBe(false)
    expect(b.calls[1]).toEqual({ op: 'eq', args: ['id', 's-1'] })
  })

  it('throws when update fails', async () => {
    nextResults['sessions'] = { data: null, error: new Error('denied') }
    await expect(archiveSession('s-1')).rejects.toThrow('denied')
  })
})

describe('restoreSession', () => {
  it('clears archived_at and filters by id', async () => {
    nextResults['sessions'] = { data: null, error: null }
    await restoreSession('s-1')
    const b = builders['sessions'][0]
    expect(b.calls).toEqual([
      { op: 'update', args: [{ archived_at: null }] },
      { op: 'eq', args: ['id', 's-1'] },
    ])
  })

  it('throws when update fails', async () => {
    nextResults['sessions'] = { data: null, error: new Error('denied') }
    await expect(restoreSession('s-1')).rejects.toThrow('denied')
  })
})

describe('restoreProject', () => {
  it('clears archived_at and filters by id', async () => {
    nextResults['projects'] = { data: null, error: null }
    await restoreProject('p-1')
    const b = builders['projects'][0]
    expect(b.calls).toEqual([
      { op: 'update', args: [{ archived_at: null }] },
      { op: 'eq', args: ['id', 'p-1'] },
    ])
  })

  it('throws when update fails', async () => {
    nextResults['projects'] = { data: null, error: new Error('denied') }
    await expect(restoreProject('p-1')).rejects.toThrow('denied')
  })
})
