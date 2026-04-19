-- Archive / restore sessions (W1-T007)
--
-- Mirrors the projects archive model (migration 008): a nullable
-- `archived_at` timestamp on `sessions`. Archive stamps the column,
-- restore clears it. The UI filters archived rows out of default
-- views but keeps them reachable on an explicit "Archived" tab.
--
-- Reversible by design — no destructive delete. Ownership and RLS
-- are untouched; updates still flow through the existing owner
-- policies from migration 003.

alter table sessions
  add column if not exists archived_at timestamptz;

-- Index supports the "archived last" ordering used by listSessions
-- (archived_at asc nulls first, then updated_at desc).
create index if not exists idx_sessions_archived
  on sessions(user_id, archived_at, updated_at desc);
