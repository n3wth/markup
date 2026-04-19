-- Decision ledger: append-only intent log attached to a doc. Shadow
-- artifact alongside the document itself so a future reader can answer
-- "who decided this, and what alternative was killed?" — something
-- version history alone can't express.
--
-- The table is intentionally permissive about content (jsonb entry)
-- because the UI is still exploratory. We'll tighten the schema once
-- the affordances stabilize.

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  paragraph_anchor text,          -- optional heading or span identifier
  entry jsonb not null,           -- { objector?, adopter?, alternative?, confidence?, rationale } — proposer lives in proposed_by (below)
  proposed_by text not null,      -- authoritative proposer: human username or agent name
  created_at timestamptz not null default now()
);

create index if not exists idx_decisions_session
  on decisions(session_id, created_at);

-- RLS: user owns decisions via session ownership. Append-only:
-- SELECT + INSERT only — no UPDATE/DELETE policies, so mutations are
-- denied by default and ledger history is immutable at the DB layer.
-- Ownership is strict (auth.uid() = sessions.user_id); we do not
-- include the "or user_id is null" anon-session shortcut here.
alter table decisions enable row level security;

drop policy if exists "decisions_owner_all" on decisions;
drop policy if exists "decisions_owner_select" on decisions;
drop policy if exists "decisions_owner_insert" on decisions;

create policy "decisions_owner_select" on decisions
  for select
  using (
    session_id in (
      select id from sessions where user_id = auth.uid()
    )
  );

create policy "decisions_owner_insert" on decisions
  for insert
  with check (
    session_id in (
      select id from sessions where user_id = auth.uid()
    )
  );

-- Enable Realtime so watching clients can see new ledger entries appear
-- live. Idempotent guard like migration 005.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'decisions'
  ) then
    alter publication supabase_realtime add table decisions;
  end if;
end $$;
