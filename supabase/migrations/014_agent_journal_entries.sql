-- Agent journal entries: append-only log of what each agent observed,
-- decided, or learned during a turn. The first half of mk-00o (Phase 1
-- agent memory & continuity) is "capture, don't read yet" — this table
-- records entries; later beads will retrieve them into prompts, surface
-- them in UI, or summarize them.
--
-- Scoping: entries belong to a project (the long-lived container) and
-- name an agent + the session that produced them. Project-scoped (not
-- session-scoped) so an agent's memory survives session churn.
--
-- The `embedding` column is nullable and unused this wave. It exists
-- to avoid a follow-up migration when semantic retrieval lands.

-- pgvector: needed for the embedding column. Idempotent — Supabase
-- ships the extension preinstalled but not enabled in every project.
create extension if not exists vector;

create table if not exists agent_journal_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_id text not null,
  session_id uuid references sessions(id) on delete set null,
  entry_text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- Recent-entries-by-agent reads dominate. Single composite index covers
-- both `recentEntries(projectId, agentId)` and project-wide listings.
create index if not exists idx_agent_journal_project_agent_created
  on agent_journal_entries(project_id, agent_id, created_at desc);

alter table agent_journal_entries enable row level security;

-- Reads/writes scope through project ownership. A user can only touch
-- journal entries for projects they own. (Cross-project sharing — when
-- it lands — will extend this policy via a join to a shares table.)
create policy "Users can read own project journal entries"
  on agent_journal_entries for select
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "Users can insert own project journal entries"
  on agent_journal_entries for insert
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "Users can delete own project journal entries"
  on agent_journal_entries for delete
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

-- Intentionally no UPDATE policy: entries are append-only. Forgetting
-- happens via DELETE (a separate bead introduces the settings UI).
