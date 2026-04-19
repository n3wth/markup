import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Structural tests for the full-text search migration (W1-T031).
 *
 * These assert the shape of 009_fulltext_search.sql so a future edit
 * cannot silently drop the tsvector columns, indexes, or RPC. They do
 * not hit a live database.
 */

const MIGRATION = readFileSync(
  resolve(__dirname, '..', '..', 'supabase', 'migrations', '009_fulltext_search.sql'),
  'utf8',
).toLowerCase()

describe('full-text search migration', () => {
  it('adds a stored tsvector column on sessions.title', () => {
    expect(MIGRATION).toMatch(
      /alter\s+table\s+sessions[\s\S]*?search_title\s+tsvector[\s\S]*?generated\s+always\s+as[\s\S]*?to_tsvector[\s\S]*?stored/,
    )
  })

  it('adds a stored tsvector column on documents.html_snapshot', () => {
    expect(MIGRATION).toMatch(
      /alter\s+table\s+documents[\s\S]*?search_content\s+tsvector[\s\S]*?generated\s+always\s+as[\s\S]*?to_tsvector[\s\S]*?stored/,
    )
  })

  it('strips HTML tags before indexing document content', () => {
    // Raw tag characters in the indexed vector would pollute results with
    // element names. Guard the regexp_replace step.
    expect(MIGRATION).toMatch(/regexp_replace[\s\S]*?<\[\^>\]\+>/)
  })

  it('creates a GIN index on sessions.search_title', () => {
    expect(MIGRATION).toMatch(
      /create\s+index\s+(?:if\s+not\s+exists\s+)?\S*\s+on\s+sessions\s+using\s+gin\s*\(\s*search_title\s*\)/,
    )
  })

  it('creates a GIN index on documents.search_content', () => {
    expect(MIGRATION).toMatch(
      /create\s+index\s+(?:if\s+not\s+exists\s+)?\S*\s+on\s+documents\s+using\s+gin\s*\(\s*search_content\s*\)/,
    )
  })

  it('defines a search_documents RPC', () => {
    expect(MIGRATION).toMatch(
      /create\s+or\s+replace\s+function\s+search_documents\s*\(\s*q\s+text/,
    )
  })

  it('search_documents returns session_id, document_id, title, updated_at, rank', () => {
    for (const field of ['session_id', 'document_id', 'title', 'updated_at', 'rank']) {
      expect(MIGRATION).toMatch(new RegExp(`\\b${field}\\b`))
    }
  })

  it('uses plainto_tsquery so raw user input cannot break tsquery parsing', () => {
    // to_tsquery throws on unescaped user punctuation; plainto_tsquery does not.
    expect(MIGRATION).toMatch(/plainto_tsquery/)
    expect(MIGRATION).not.toMatch(/\bto_tsquery\s*\(/)
  })

  it('weights title matches above content matches', () => {
    // Two setweight calls -- 'A' for title, 'B' for content.
    expect(MIGRATION).toMatch(/setweight\([\s\S]*?search_title[\s\S]*?,\s*'a'\)/)
    expect(MIGRATION).toMatch(/setweight\([\s\S]*?search_content[\s\S]*?,\s*'b'\)/)
  })

  it('ranks with ts_rank_cd and breaks ties by updated_at desc', () => {
    expect(MIGRATION).toMatch(/ts_rank_cd/)
    expect(MIGRATION).toMatch(/order\s+by\s+rank\s+desc,\s*s\.updated_at\s+desc/)
  })

  it('clamps max_results between 1 and 100', () => {
    expect(MIGRATION).toMatch(/greatest\s*\(\s*1\s*,\s*least\s*\(/)
    expect(MIGRATION).toMatch(/100/)
  })

  it('grants execute to anon and authenticated', () => {
    expect(MIGRATION).toMatch(
      /grant\s+execute\s+on\s+function\s+search_documents[\s\S]*?to\s+anon,\s*authenticated/,
    )
  })

  it('is a security-invoker function (no explicit security definer)', () => {
    // security definer would bypass RLS. Guard against a future edit flipping
    // this by asserting the keyword is absent.
    expect(MIGRATION).not.toMatch(/security\s+definer/)
  })
})
