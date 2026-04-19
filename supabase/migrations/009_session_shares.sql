-- Session shares: grants of access to a session for a specific principal
-- (an email address, or an opaque share-link token). Each row is one grant
-- with one role and an optional expiry.
--
-- Role semantics (enforced in app code by W1-T012 commenter and W1-T013
-- editor):
--   viewer    -- read doc + chat
--   commenter -- read doc + chat, plus comment-only insertions
--   editor    -- full edit, minus delete-session
--
-- Principal:
--   email -- principal stores the lowercased email; recipient access is
--            granted on auth.email() match in a later migration once the
--            commenter/editor read paths land.
--   token -- principal stores the share-link token (W1-T010); the link
--            holder presents it via the app, which mediates access.
--
-- This migration ships only the owner-scope RLS surface: the session
-- owner can fully manage the rows (create / read / update / delete the
-- grants for their own sessions). Recipient-side access policies for
-- shared sessions live with W1-T012/T013 so they can be tested with the
-- commenter/editor read paths.

create table if not exists session_shares (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  principal_type text not null check (principal_type in ('email', 'token')),
  principal text not null,
  role text not null check (role in ('viewer', 'commenter', 'editor')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, principal_type, principal)
);

create index if not exists idx_session_shares_session
  on session_shares(session_id);

create index if not exists idx_session_shares_principal
  on session_shares(principal_type, principal);

alter table session_shares enable row level security;

-- Owner-scoped management. A session owner sees and edits all share
-- grants attached to their sessions. Recipients do not read this table
-- directly; their access to the shared session/document/chat is mediated
-- by policies introduced with the commenter and editor roles.

create policy "Session owners can read shares"
  on session_shares for select
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Session owners can create shares"
  on session_shares for insert
  with check (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Session owners can update shares"
  on session_shares for update
  using (session_id in (select id from sessions where user_id = auth.uid()));

create policy "Session owners can delete shares"
  on session_shares for delete
  using (session_id in (select id from sessions where user_id = auth.uid()));
