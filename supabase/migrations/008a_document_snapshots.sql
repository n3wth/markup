-- Document snapshots: append-only history of document content for the
-- time-machine feature. A new row is created on each save so users can
-- scrub back through document state. Content is the full Tiptap JSON
-- blob; author is a free-form label ("user", "agent:aiden", etc.) so we
-- don't have to join to auth.users for display.

create table if not exists document_snapshots (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references documents(id) on delete cascade,
  content jsonb not null,
  created_at timestamptz not null default now(),
  author text not null default 'unknown'
);

create index if not exists document_snapshots_doc_id_created_at_idx
  on document_snapshots (doc_id, created_at desc);

alter table document_snapshots enable row level security;

-- Snapshots scope via document → session ownership. Mirrors the
-- pattern used for documents/chat_messages/agent_personas in 003.
create policy "Users can read own document snapshots"
  on document_snapshots for select
  using (
    doc_id in (
      select id from documents
      where session_id in (select id from sessions where user_id = auth.uid())
    )
  );

create policy "Users can create own document snapshots"
  on document_snapshots for insert
  with check (
    doc_id in (
      select id from documents
      where session_id in (select id from sessions where user_id = auth.uid())
    )
  );

create policy "Users can delete own document snapshots"
  on document_snapshots for delete
  using (
    doc_id in (
      select id from documents
      where session_id in (select id from sessions where user_id = auth.uid())
    )
  );
