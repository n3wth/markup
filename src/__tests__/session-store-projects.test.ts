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
let currentUserId: string | null = null

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const result = nextResults[table] ?? { data: [], error: null }
      return makeBuilder(table, result)
    }),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: currentUserId ? { user: { id: currentUserId } } : null },
      })),
    },
  },
}))

import {
  loadProjects,
  createProject,
  renameProject,
  archiveProject,
} from '../lib/session-store'

beforeEach(() => {
  for (const k of Object.keys(builders)) delete builders[k]
  nextResults = {}
  currentUserId = null
})

describe('loadProjects', () => {
  it('selects all projects, sorts non-archived first, then by created_at desc', async () => {
    const now = '2026-04-19T00:00:00Z'
    nextResults['projects'] = {
      data: [
        { id: 'p-1', user_id: 'u-1', title: 'Inbox', archived_at: null, created_at: now },
        { id: 'p-2', user_id: 'u-1', title: 'Old', archived_at: now, created_at: now },
      ],
      error: null,
    }

    const result = await loadProjects()

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Inbox')

    const b = builders['projects'][0]
    expect(b.calls).toEqual([
      { op: 'select', args: ['*'] },
      { op: 'order', args: ['archived_at', { ascending: true, nullsFirst: true }] },
      { op: 'order', args: ['created_at', { ascending: false }] },
    ])
  })

  it('returns [] when the table is empty', async () => {
    nextResults['projects'] = { data: [], error: null }
    const result = await loadProjects()
    expect(result).toEqual([])
  })

  it('throws when supabase returns an error', async () => {
    nextResults['projects'] = { data: null, error: new Error('rls denied') }
    await expect(loadProjects()).rejects.toThrow('rls denied')
  })
})

describe('createProject', () => {
  it('inserts a row with title and user_id when authenticated', async () => {
    currentUserId = 'u-42'
    const row = {
      id: 'p-new',
      user_id: 'u-42',
      title: 'Side projects',
      archived_at: null,
      created_at: '2026-04-19T00:00:00Z',
    }
    nextResults['projects'] = { data: row, error: null }

    const result = await createProject('Side projects')

    expect(result.id).toBe('p-new')
    expect(result.title).toBe('Side projects')

    const b = builders['projects'][0]
    expect(b.calls[0]).toEqual({
      op: 'insert',
      args: [{ title: 'Side projects', user_id: 'u-42' }],
    })
    expect(b.calls[1]).toEqual({ op: 'select', args: [undefined] })
    expect(b.calls[2]).toEqual({ op: 'single', args: [] })
  })

  it('omits user_id when no session', async () => {
    currentUserId = null
    nextResults['projects'] = {
      data: { id: 'p-x', user_id: null, title: 'T', archived_at: null, created_at: 'now' },
      error: null,
    }
    await createProject('T')
    const b = builders['projects'][0]
    expect(b.calls[0]).toEqual({ op: 'insert', args: [{ title: 'T' }] })
  })

  it('throws when insert fails outside local dev', async () => {
    nextResults['projects'] = { data: null, error: new Error('insert failed') }
    await expect(createProject('X')).rejects.toThrow('insert failed')
  })
})

describe('renameProject', () => {
  it('updates the title where id matches', async () => {
    nextResults['projects'] = { data: null, error: null }
    await renameProject('p-1', 'Renamed')
    const b = builders['projects'][0]
    expect(b.calls).toEqual([
      { op: 'update', args: [{ title: 'Renamed' }] },
      { op: 'eq', args: ['id', 'p-1'] },
    ])
  })

  it('throws when update fails', async () => {
    nextResults['projects'] = { data: null, error: new Error('denied') }
    await expect(renameProject('p-1', 'x')).rejects.toThrow('denied')
  })
})

describe('archiveProject', () => {
  it('stamps archived_at and filters by id', async () => {
    nextResults['projects'] = { data: null, error: null }
    await archiveProject('p-1')
    const b = builders['projects'][0]
    expect(b.calls).toHaveLength(2)
    expect(b.calls[0].op).toBe('update')
    const updateArg = b.calls[0].args[0] as { archived_at: string }
    expect(typeof updateArg.archived_at).toBe('string')
    expect(Number.isNaN(Date.parse(updateArg.archived_at))).toBe(false)
    expect(b.calls[1]).toEqual({ op: 'eq', args: ['id', 'p-1'] })
  })

  it('throws when update fails', async () => {
    nextResults['projects'] = { data: null, error: new Error('denied') }
    await expect(archiveProject('p-1')).rejects.toThrow('denied')
  })
})
