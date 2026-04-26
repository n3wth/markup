-- Projects: a container for sessions. Each user has one or more projects;
-- every session belongs to exactly one project. The default "Inbox" project
-- is auto-created per user so the UI never has to handle a project-less
-- session state.
--
-- W1-T002 will refine the policy surface (sharing, archive scopes). This
-- migration ships the minimum auth.uid() guard so the table is never
-- exposed without RLS. The rls-policies test enforces this on every table
-- that exists, including future ones.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Inbox',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user
  on projects(user_id, archived_at, created_at);

-- Sessions get a nullable FK first so we can backfill, then we tighten.
alter table sessions
  add column if not exists project_id uuid references projects(id) on delete cascade;

create index if not exists idx_sessions_project
  on sessions(project_id);

-- Backfill: one "Inbox" project per distinct user_id present on sessions,
-- then point every session at its user's Inbox.
insert into projects (user_id, title)
select distinct s.user_id, 'Inbox'
from sessions s
where s.user_id is not null
  and not exists (
    select 1 from projects p
    where p.user_id = s.user_id and p.title = 'Inbox'
  );

update sessions s
set project_id = p.id
from projects p
where s.project_id is null
  and s.user_id is not null
  and p.user_id = s.user_id
  and p.title = 'Inbox';

-- Minimum RLS guard. W1-T002 will expand to cover sharing.
alter table projects enable row level security;

create policy "Users can read own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can create own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);
