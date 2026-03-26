-- Add user_id to sessions so each session belongs to a user
alter table sessions add column user_id uuid references auth.users(id) on delete cascade;

-- Backfill: assign existing sessions to the first authenticated user (if any)
-- In production, run a manual backfill before enabling strict RLS
update sessions set user_id = (select id from auth.users limit 1) where user_id is null;

-- Make user_id required going forward
alter table sessions alter column user_id set default auth.uid();

-- Drop permissive policies
drop policy if exists "public_sessions" on sessions;
drop policy if exists "public_documents" on documents;
drop policy if exists "public_chat" on chat_messages;
drop policy if exists "public_personas" on agent_personas;

-- Sessions: users can only access their own
create policy "Users can read own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete
  using (auth.uid() = user_id);

-- Documents: access through session ownership
create policy "Users can read own documents"
  on documents for select
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can create own documents"
  on documents for insert
  with check (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can update own documents"
  on documents for update
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can delete own documents"
  on documents for delete
  using (session_id in (select id from sessions where user_id = auth.uid()));

-- Chat messages: access through session ownership
create policy "Users can read own chat messages"
  on chat_messages for select
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can create own chat messages"
  on chat_messages for insert
  with check (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can delete own chat messages"
  on chat_messages for delete
  using (session_id in (select id from sessions where user_id = auth.uid()));

-- Agent personas: access through session ownership
create policy "Users can read own agent personas"
  on agent_personas for select
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can create own agent personas"
  on agent_personas for insert
  with check (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can update own agent personas"
  on agent_personas for update
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Users can delete own agent personas"
  on agent_personas for delete
  using (session_id in (select id from sessions where user_id = auth.uid()));
