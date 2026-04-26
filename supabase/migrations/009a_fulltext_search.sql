-- Full-text search across a user's docs (W1-T031).
--
-- Adds generated tsvector columns on sessions.title and documents.html_snapshot
-- with GIN indexes, plus a security-invoker RPC (`search_documents`) that
-- returns matching sessions ranked by relevance. The RPC relies entirely on
-- the existing RLS policies on sessions/documents for scoping, so a caller
-- can only ever see their own rows.
--
-- Notes on the content column:
--   - documents.html_snapshot stores Tiptap HTML. tsvector on raw HTML would
--     index tag names and attributes, so we strip tags in the generated
--     expression with regexp_replace before handing it to to_tsvector.
--   - We use the 'english' config. This matches Postgres defaults and is good
--     enough for v1; switching to 'simple' or a language-aware config is a
--     follow-up if stemming becomes a problem.

-- sessions.title -> search_title
alter table sessions
  add column if not exists search_title tsvector
  generated always as (to_tsvector('english', coalesce(title, ''))) stored;

create index if not exists idx_sessions_search_title
  on sessions using gin (search_title);

-- documents.html_snapshot -> search_content (tags stripped)
alter table documents
  add column if not exists search_content tsvector
  generated always as (
    to_tsvector(
      'english',
      regexp_replace(coalesce(html_snapshot, ''), '<[^>]+>', ' ', 'g')
    )
  ) stored;

create index if not exists idx_documents_search_content
  on documents using gin (search_content);

-- RPC: search_documents
--
-- Runs with the caller's auth context (security invoker is the Postgres
-- default for `create function`), so RLS on sessions/documents filters rows
-- to the caller. `plainto_tsquery` parses user input as a plain phrase
-- ("dog toy" -> 'dog & toy'), which avoids tsquery syntax errors from
-- untrusted input.
--
-- Ranking: ts_rank_cd on the combined title+content vectors, with a 2x
-- weight bump for title matches (A vs B via setweight). Ties break by
-- sessions.updated_at desc so fresh docs win.

create or replace function search_documents(q text, max_results int default 20)
returns table (
  session_id uuid,
  document_id uuid,
  title text,
  updated_at timestamptz,
  rank real
)
language sql
stable
as $$
  with query as (
    select plainto_tsquery('english', coalesce(q, '')) as tsq
  )
  select
    s.id as session_id,
    d.id as document_id,
    s.title,
    s.updated_at,
    ts_rank_cd(
      setweight(coalesce(s.search_title, ''::tsvector), 'A')
        || setweight(coalesce(d.search_content, ''::tsvector), 'B'),
      (select tsq from query)
    ) as rank
  from sessions s
  left join documents d on d.session_id = s.id
  where
    (select tsq from query) @@ (
      setweight(coalesce(s.search_title, ''::tsvector), 'A')
        || setweight(coalesce(d.search_content, ''::tsvector), 'B')
    )
  order by rank desc, s.updated_at desc
  limit greatest(1, least(coalesce(max_results, 20), 100));
$$;

-- Explicit grant so anon + authenticated can both call it; RLS still scopes
-- what they see. anon will only match unowned rows (which shouldn't exist
-- post-003), authenticated sees their own.
grant execute on function search_documents(text, int) to anon, authenticated;
