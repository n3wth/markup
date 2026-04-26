import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ────────────────────────────────────────────────────────────
// Mirrors the builder pattern used in session-store-projects.test.ts.

interface BuilderCall {
  op: string
  args: unknown[]
}

interface Builder {
  calls: BuilderCall[]
  result: { data: unknown; error: unknown }
  select: (cols?: string) => Builder
  insert: (row: unknown) => Builder
  eq: (col: string, val: unknown) => Builder
  order: (col: string, opts?: unknown) => Builder
  limit: (n: number) => Builder
  single: () => Builder
  then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => Promise<unknown>
}

const builders: Record<string, Builder[]> = {}
let nextResults: Record<string, { data: unknown; error: unknown }> = {}

function makeBuilder(table: string, result: { data: unknown; error: unknown }): Builder {
  const calls: BuilderCall[] = []
  const b: Builder = {
    calls,
    result,
    select(cols) { calls.push({ op: 'select', args: [cols] }); return b },
    insert(row) { calls.push({ op: 'insert', args: [row] }); return b },
    eq(col, val) { calls.push({ op: 'eq', args: [col, val] }); return b },
    order(col, opts) { calls.push({ op: 'order', args: [col, opts] }); return b },
    limit(n) { calls.push({ op: 'limit', args: [n] }); return b },
    single() { calls.push({ op: 'single', args: [] }); return b },
    then(onFulfilled) { return Promise.resolve(result).then(onFulfilled) },
  }
  if (!builders[table]) builders[table] = []
  builders[table].push(b)
  return b
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const result = nextResults[table] ?? { data: [], error: null }
      return makeBuilder(table, result)
    }),
  },
}))

import { appendEntry, recentEntries } from '../server/agent-journal'

beforeEach(() => {
  for (const k of Object.keys(builders)) delete builders[k]
  nextResults = {}
})

// ── appendEntry ──────────────────────────────────────────────────────────────

describe('appendEntry', () => {
  it('inserts an entry and returns the created row', async () => {
    const row = {
      id: 'entry-1',
      project_id: 'proj-1',
      agent_id: 'Aiden',
      session_id: 'sess-1',
      entry_text: 'User prefers terser prose.',
      created_at: '2026-04-26T00:00:00Z',
    }
    nextResults['agent_journal_entries'] = { data: row, error: null }

    const result = await appendEntry('proj-1', 'Aiden', 'sess-1', 'User prefers terser prose.')

    expect(result).toEqual(row)
    const b = builders['agent_journal_entries'][0]
    const insertCall = b.calls.find(c => c.op === 'insert')
    expect(insertCall?.args[0]).toMatchObject({
      project_id: 'proj-1',
      agent_id: 'Aiden',
      session_id: 'sess-1',
      entry_text: 'User prefers terser prose.',
    })
  })

  it('returns null and does not insert when entryText is blank', async () => {
    const result = await appendEntry('proj-1', 'Aiden', 'sess-1', '   ')
    expect(result).toBeNull()
    expect(builders['agent_journal_entries']).toBeUndefined()
  })

  it('returns null and does not insert when projectId is missing', async () => {
    const result = await appendEntry('', 'Aiden', 'sess-1', 'some text')
    expect(result).toBeNull()
    expect(builders['agent_journal_entries']).toBeUndefined()
  })

  it('returns null and does not insert when agentId is missing', async () => {
    const result = await appendEntry('proj-1', '', 'sess-1', 'some text')
    expect(result).toBeNull()
    expect(builders['agent_journal_entries']).toBeUndefined()
  })

  it('swallows supabase errors and returns null', async () => {
    nextResults['agent_journal_entries'] = { data: null, error: { message: 'RLS denied' } }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await appendEntry('proj-1', 'Aiden', 'sess-1', 'some text')
    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith('[agent-journal] appendEntry failed:', 'RLS denied')
    warnSpy.mockRestore()
  })

  it('accepts null sessionId', async () => {
    const row = {
      id: 'entry-2',
      project_id: 'proj-1',
      agent_id: 'Nova',
      session_id: null,
      entry_text: 'Note without session.',
      created_at: '2026-04-26T00:00:00Z',
    }
    nextResults['agent_journal_entries'] = { data: row, error: null }
    const result = await appendEntry('proj-1', 'Nova', null, 'Note without session.')
    expect(result?.session_id).toBeNull()
  })
})

// ── recentEntries ────────────────────────────────────────────────────────────

describe('recentEntries', () => {
  it('returns entries ordered newest first, limited to requested count', async () => {
    const rows = [
      { id: 'e2', project_id: 'proj-1', agent_id: 'Aiden', session_id: null, entry_text: 'later', created_at: '2026-04-26T01:00:00Z' },
      { id: 'e1', project_id: 'proj-1', agent_id: 'Aiden', session_id: null, entry_text: 'earlier', created_at: '2026-04-26T00:00:00Z' },
    ]
    nextResults['agent_journal_entries'] = { data: rows, error: null }

    const result = await recentEntries('proj-1', 'Aiden', 2)

    expect(result).toHaveLength(2)
    expect(result[0].entry_text).toBe('later')

    const b = builders['agent_journal_entries'][0]
    expect(b.calls).toContainEqual({ op: 'eq', args: ['project_id', 'proj-1'] })
    expect(b.calls).toContainEqual({ op: 'eq', args: ['agent_id', 'Aiden'] })
    expect(b.calls).toContainEqual({ op: 'order', args: ['created_at', { ascending: false }] })
    expect(b.calls).toContainEqual({ op: 'limit', args: [2] })
  })

  it('returns [] when projectId is missing', async () => {
    const result = await recentEntries('', 'Aiden')
    expect(result).toEqual([])
    expect(builders['agent_journal_entries']).toBeUndefined()
  })

  it('returns [] when agentId is missing', async () => {
    const result = await recentEntries('proj-1', '')
    expect(result).toEqual([])
    expect(builders['agent_journal_entries']).toBeUndefined()
  })

  it('swallows supabase errors and returns []', async () => {
    nextResults['agent_journal_entries'] = { data: null, error: { message: 'network error' } }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await recentEntries('proj-1', 'Aiden')
    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith('[agent-journal] recentEntries failed:', 'network error')
    warnSpy.mockRestore()
  })

  it('uses default limit of 10', async () => {
    nextResults['agent_journal_entries'] = { data: [], error: null }
    await recentEntries('proj-1', 'Aiden')
    const b = builders['agent_journal_entries'][0]
    expect(b.calls).toContainEqual({ op: 'limit', args: [10] })
  })
})
