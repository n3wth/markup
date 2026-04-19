import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * RLS boundary assertions on migration SQL.
 *
 * These tests guard the Supabase migrations from regressing on row-level
 * security. They do NOT hit a live database; they parse the .sql files
 * as text and assert structural properties:
 *
 *   1. For every session-owned table, `enable row level security` is
 *      present in one of the migrations.
 *   2. At least one `create policy` on that table references
 *      `auth.uid()` (directly, or via a `sessions.user_id = auth.uid()`
 *      subquery for join-tables).
 *
 * This is a hermetic safety net for the persistence work in Waves 1-3.
 * A richer check (mocked client or live Postgres) can come as a
 * follow-up.
 */

const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'supabase', 'migrations')

// Session-owned tables that must have RLS enabled and an auth.uid()
// policy in the current schema.
const REQUIRED_TABLES = [
  'sessions',
  'documents',
  'chat_messages',
  'agent_tasks',
  'agent_personas',
  'user_settings',
] as const

// Tables that may land in later waves. If present, same check applies.
const FUTURE_TABLES = [
  'projects',
  'session_shares',
  'agent_memories',
  'document_snapshots',
] as const

function loadMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
}

function normalize(sql: string): string {
  // Strip SQL line comments, collapse whitespace, lowercase for
  // case-insensitive matching. Preserves newlines so statement
  // boundaries remain detectable.
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .toLowerCase()
}

function rlsEnabledFor(sql: string, table: string): boolean {
  // Matches: alter table [if exists] [public.]<table> enable row level security
  const pattern = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${table}\\b[\\s\\S]*?enable\\s+row\\s+level\\s+security`,
    'i'
  )
  return pattern.test(sql)
}

function policiesFor(sql: string, table: string): string[] {
  // Extracts each `create policy ... on <table> ... ;` statement body.
  const pattern = new RegExp(
    `create\\s+policy[\\s\\S]*?on\\s+(?:public\\.)?${table}\\b[\\s\\S]*?;`,
    'gi'
  )
  return sql.match(pattern) ?? []
}

function hasAuthUidPolicy(sql: string, table: string): boolean {
  const policies = policiesFor(sql, table)
  return policies.some((policy) => /auth\.uid\s*\(\s*\)/.test(policy))
}

function tableExists(sql: string, table: string): boolean {
  const pattern = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${table}\\b`,
    'i'
  )
  return pattern.test(sql)
}

describe('RLS policy boundaries (migrations)', () => {
  const sql = normalize(loadMigrations())

  describe('required session-owned tables', () => {
    for (const table of REQUIRED_TABLES) {
      describe(table, () => {
        it('is defined in migrations', () => {
          expect(tableExists(sql, table)).toBe(true)
        })

        it('has row level security enabled', () => {
          expect(rlsEnabledFor(sql, table)).toBe(true)
        })

        it('has at least one policy referencing auth.uid()', () => {
          expect(hasAuthUidPolicy(sql, table)).toBe(true)
        })
      })
    }
  })

  describe('future tables (Wave 1-3)', () => {
    for (const table of FUTURE_TABLES) {
      it(`${table}: if present, enforces auth.uid() policy`, () => {
        if (!tableExists(sql, table)) {
          // Not yet introduced; skip silently. This test will start
          // enforcing once the migration lands.
          return
        }
        expect(rlsEnabledFor(sql, table)).toBe(true)
        expect(hasAuthUidPolicy(sql, table)).toBe(true)
      })
    }
  })

  describe('permissive legacy policies', () => {
    it('does not leave a public_sessions policy active on sessions', () => {
      // Migration 001 created a permissive "public_sessions" policy.
      // Migration 003 must drop it. Assert the drop is present so a
      // future edit to 003 cannot regress the boundary.
      expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"public_sessions"\s+on\s+sessions/)
    })

    it('does not leave a public_documents policy active on documents', () => {
      expect(sql).toMatch(
        /drop\s+policy\s+if\s+exists\s+"public_documents"\s+on\s+documents/
      )
    })

    it('does not leave a public_chat policy active on chat_messages', () => {
      expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+"public_chat"\s+on\s+chat_messages/)
    })

    it('does not leave a public_personas policy active on agent_personas', () => {
      expect(sql).toMatch(
        /drop\s+policy\s+if\s+exists\s+"public_personas"\s+on\s+agent_personas/
      )
    })

    it('does not leave an "Allow all for anon" policy active on agent_tasks', () => {
      expect(sql).toMatch(
        /drop\s+policy\s+if\s+exists\s+"allow all for anon"\s+on\s+agent_tasks/
      )
    })
  })

  describe('cross-user isolation shape', () => {
    it('sessions scope by sessions.user_id = auth.uid()', () => {
      const policies = policiesFor(sql, 'sessions')
      const ownerScoped = policies.some((p) => /auth\.uid\s*\(\s*\)\s*=\s*user_id/.test(p))
      expect(ownerScoped).toBe(true)
    })

    it('documents scope via session ownership subquery', () => {
      const policies = policiesFor(sql, 'documents')
      const joinedToSessions = policies.some(
        (p) =>
          /session_id\s+in\s*\(\s*select\s+id\s+from\s+sessions\s+where\s+user_id\s*=\s*auth\.uid/.test(
            p
          )
      )
      expect(joinedToSessions).toBe(true)
    })

    it('chat_messages scope via session ownership subquery', () => {
      const policies = policiesFor(sql, 'chat_messages')
      const joinedToSessions = policies.some(
        (p) =>
          /session_id\s+in\s*\(\s*select\s+id\s+from\s+sessions\s+where\s+user_id\s*=\s*auth\.uid/.test(
            p
          )
      )
      expect(joinedToSessions).toBe(true)
    })

    it('agent_personas scope via session ownership subquery', () => {
      const policies = policiesFor(sql, 'agent_personas')
      const joinedToSessions = policies.some(
        (p) =>
          /session_id\s+in\s*\(\s*select\s+id\s+from\s+sessions\s+where\s+user_id\s*=\s*auth\.uid/.test(
            p
          )
      )
      expect(joinedToSessions).toBe(true)
    })

    it('user_settings scope by user_settings.user_id = auth.uid()', () => {
      const policies = policiesFor(sql, 'user_settings')
      const ownerScoped = policies.some((p) => /auth\.uid\s*\(\s*\)\s*=\s*user_id/.test(p))
      expect(ownerScoped).toBe(true)
    })
  })

  it('loads at least one migration file', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f: string) => f.endsWith('.sql'))
    expect(files.length).toBeGreaterThan(0)
  })
})

// Unit tests for the small parsing helpers so regressions in the
// regex shapes surface here instead of as false positives/negatives
// against real migrations.
describe('RLS parsing helpers', () => {
  it('rlsEnabledFor detects a direct ALTER TABLE ... ENABLE ROW LEVEL SECURITY', () => {
    const sql = 'alter table widgets enable row level security;'
    expect(rlsEnabledFor(sql, 'widgets')).toBe(true)
  })

  it('rlsEnabledFor returns false when RLS is not enabled on the table', () => {
    const sql = 'alter table other_table enable row level security;'
    expect(rlsEnabledFor(sql, 'widgets')).toBe(false)
  })

  it('hasAuthUidPolicy recognizes auth.uid() inside a policy body', () => {
    const sql = `create policy "own widgets" on widgets for select using (user_id = auth.uid());`
    expect(hasAuthUidPolicy(sql, 'widgets')).toBe(true)
  })

  it('hasAuthUidPolicy returns false for a policy without auth.uid()', () => {
    const sql = `create policy "public widgets" on widgets for select using (true);`
    expect(hasAuthUidPolicy(sql, 'widgets')).toBe(false)
  })

  it('policiesFor scopes to the named table only', () => {
    const sql = `
      create policy "a" on widgets for select using (auth.uid() = user_id);
      create policy "b" on gadgets for select using (auth.uid() = user_id);
    `
    expect(policiesFor(sql, 'widgets')).toHaveLength(1)
    expect(policiesFor(sql, 'gadgets')).toHaveLength(1)
  })
})
