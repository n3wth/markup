-- Standing objections: a dissenting voice attached to a doc that
-- travels with it forever. Borrowed from Quaker practice and IETF
-- rough-consensus ("standing aside"). See
-- docs/brainstorms/2026-04-19-multi-entity-collab-design-lenses.md,
-- lens 2 — "the dissent primitive".
--
-- Shipping as a first-class row rather than an attribute on chat
-- messages so an objection is legible in its own right: "Maya
-- standing-objects to the pricing model" should read as a structural
-- fact about this doc, not a comment buried in a thread.
--
-- UPDATE is allowed so an objector can retract (set withdrawn_at);
-- DELETE is not policed, so objections cannot be erased from the
-- record even after withdrawal. A trigger below also pins
-- session_id so an objection can't be moved between docs via UPDATE.

create table if not exists standing_objections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  objector text not null,             -- human username or agent name
  subject text not null,              -- what the objector is objecting to, in their own words
  rationale text,                     -- optional longer reasoning
  section_anchor text,                -- optional heading / span the objection attaches to
  withdrawn_at timestamptz,           -- null = still standing; set to retract
  created_at timestamptz not null default now()
);

create index if not exists idx_standing_objections_session
  on standing_objections(session_id, created_at);

-- Ownership via session; strict (no "user_id is null" shortcut).
alter table standing_objections enable row level security;

drop policy if exists "standing_objections_owner_all" on standing_objections;
drop policy if exists "standing_objections_owner_select" on standing_objections;
drop policy if exists "standing_objections_owner_insert" on standing_objections;
drop policy if exists "standing_objections_owner_update" on standing_objections;

create policy "standing_objections_owner_select" on standing_objections
  for select
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

create policy "standing_objections_owner_insert" on standing_objections
  for insert
  with check (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- UPDATE only, to support withdrawal. No DELETE policy — the record
-- persists even after withdrawal.
create policy "standing_objections_owner_update" on standing_objections
  for update
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  )
  with check (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Objections are historical record. The RLS WITH CHECK re-validates
-- ownership but doesn't prevent moving a row between two sessions the
-- user owns, nor rewriting objector/subject/etc. after the fact. The
-- trigger below freezes every immutable field, leaving only
-- `withdrawn_at` mutable (the sole legitimate update — retraction).
create or replace function prevent_standing_objections_history_rewrite()
returns trigger
language plpgsql
as $$
begin
  if new.session_id <> old.session_id then
    raise exception 'standing_objections.session_id is immutable';
  end if;
  if new.objector is distinct from old.objector then
    raise exception 'standing_objections.objector is immutable';
  end if;
  if new.subject is distinct from old.subject then
    raise exception 'standing_objections.subject is immutable';
  end if;
  if new.rationale is distinct from old.rationale then
    raise exception 'standing_objections.rationale is immutable';
  end if;
  if new.section_anchor is distinct from old.section_anchor then
    raise exception 'standing_objections.section_anchor is immutable';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'standing_objections.created_at is immutable';
  end if;
  return new;
end;
$$;

-- Drop the older, narrower trigger name from an earlier commit on this
-- branch so the migration is idempotent across reruns.
drop trigger if exists trg_prevent_standing_objections_session_change on standing_objections;
drop trigger if exists trg_prevent_standing_objections_history_rewrite on standing_objections;
create trigger trg_prevent_standing_objections_history_rewrite
  before update on standing_objections
  for each row
  execute function prevent_standing_objections_history_rewrite();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'standing_objections'
  ) then
    alter publication supabase_realtime add table standing_objections;
  end if;
end $$;
