-- Agent task system: shared task board for agent-human collaboration
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'complete', 'dismissed')),
  assigned_agents text[] not null default '{}',
  created_by text not null default 'user',
  section_anchor text,
  sort_order integer not null default 0,
  completed_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_agent_tasks_session on agent_tasks(session_id, sort_order);

-- RLS: user owns tasks via session ownership
alter table agent_tasks enable row level security;

create policy "Users can manage tasks in their sessions"
  on agent_tasks for all
  using (session_id in (select id from sessions where user_id = auth.uid()))
  with check (session_id in (select id from sessions where user_id = auth.uid()));

-- Permissive policy for anonymous/localhost usage (matches existing pattern)
create policy "Allow all for anon"
  on agent_tasks for all
  using (true)
  with check (true);
