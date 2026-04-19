-- Enable Supabase Realtime on documents so authorized clients in
-- spectator/view mode (for example, loading a session with ?view=1) can
-- receive live updates without polling. This is an additive change only;
-- it does not modify schema, authentication, or RLS — subscribers still
-- only see rows they're already permitted to read.
--
-- Wrapped in a guard so the migration is idempotent: ALTER PUBLICATION
-- ... ADD TABLE errors if the table is already a member (e.g. if an
-- environment added it manually through the dashboard).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table documents;
  end if;
end $$;
