-- Agent journal: append-only per-agent, per-project memory entries.
-- Each agent turn may emit a memoryText reflection; this table stores them.
-- Retrieval is recency-based for v1 (semantic search deferred to v2).

create table if not exists agent_journal_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_id text not null,
  session_id uuid not null references sessions(id) on delete cascade,
  entry_text text not null check (char_length(entry_text) <= 2000),
  created_at timestamptz not null default now(),
  -- nullable vector for future semantic search (pgvector extension)
  embedding vector(1536)
);

-- Fast lookup: most recent entries for a (project, agent) pair
create index if not exists idx_journal_project_agent_recent
  on agent_journal_entries(project_id, agent_id, created_at desc);

-- RLS: users can only see journal entries for sessions they own or share
alter table agent_journal_entries enable row level security;

-- Read policy: matches sessions the user owns (via session.user_id)
-- or sessions shared with them (via session_shares table)
create policy "users can read own journal entries"
  on agent_journal_entries for select
  using (
    exists (
      select 1 from sessions s
      where s.id = agent_journal_entries.session_id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from session_shares ss
            where ss.session_id = s.id
              and ss.shared_with_user_id = auth.uid()
          )
        )
    )
  );

-- Write policy: only the session owner can append entries
create policy "users can write own journal entries"
  on agent_journal_entries for insert
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );
