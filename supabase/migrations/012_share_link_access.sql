-- Share-link recipient access + analytics (mk-hoz).
--
-- Builds on 009_session_shares (owner-scope) and 014 (listShares/revokeShare)
-- by adding two pieces needed for the end-to-end share flow:
--
-- 1) share_events — one row per time a share link is opened. Owner-scoped
--    reads (so the owner sees who's visiting) and public inserts keyed on
--    a valid share_id (so anonymous viewers can be logged without RLS
--    rejecting the insert).
--
-- 2) A SECURITY DEFINER RPC `resolve_share_link(token)` that returns the
--    session + document data an anonymous recipient needs, scoped to the
--    role on the share grant. Keeping this in an RPC (rather than a
--    recipient-side SELECT policy) avoids having to thread a GUC through
--    every supabase-js query: the app just calls `supabase.rpc(...)` with
--    the token once per link-open and gets a single payload back.
--
--    The function checks token validity, expiry, and returns NULL when
--    anything is off. No enumeration risk: an attacker who probes random
--    tokens sees the same NULL response as an invalid one.

create table if not exists share_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references session_shares(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  opened_at timestamptz not null default now()
);

create index if not exists idx_share_events_share
  on share_events(share_id, opened_at desc);

alter table share_events enable row level security;

-- Owner reads: the session owner sees all opens for their shares.
create policy "Owners read share events"
  on share_events for select
  using (
    share_id in (
      select s.id from session_shares s
      join sessions ss on ss.id = s.session_id
      where ss.user_id = auth.uid()
    )
  );

-- Public inserts: any caller (including anon) can log an open event for
-- a share they can reach. The insert must reference a real share row;
-- invalid share_ids fail the FK check. This is fine — we do not expose
-- a way to enumerate share ids, so writing an event requires holding the
-- token out-of-band.
create policy "Anyone can log share event"
  on share_events for insert
  with check (share_id is not null);

-- Resolve a share-link token into the session + doc payload needed to
-- render a read-only view. SECURITY DEFINER so the function bypasses
-- table RLS for the specific lookups it performs, but only after
-- validating the token + expiry.
--
-- Returns NULL (no rows) when the token is unknown or expired, so the
-- caller cannot distinguish between "no such token" and "revoked".
create or replace function resolve_share_link(token text)
returns table (
  share_id uuid,
  session_id uuid,
  role text,
  session_title text,
  session_template text,
  document_html text,
  document_updated_at timestamptz
) as $$
  select
    s.id as share_id,
    s.session_id,
    s.role,
    ss.title as session_title,
    ss.template as session_template,
    d.html_snapshot as document_html,
    d.updated_at as document_updated_at
  from session_shares s
  join sessions ss on ss.id = s.session_id
  left join documents d on d.session_id = s.session_id
  where s.principal_type = 'token'
    and s.principal = token
    and (s.expires_at is null or s.expires_at > now())
  limit 1
$$ language sql security definer stable;

-- Anyone (incl. anon) may call the RPC. It's the function body that
-- decides whether the token is honored.
grant execute on function resolve_share_link(text) to anon, authenticated;
