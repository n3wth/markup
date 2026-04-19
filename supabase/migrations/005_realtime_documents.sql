-- Enable Supabase Realtime on documents so authorized clients in
-- spectator/view mode (for example, loading a session with ?view=1) can
-- receive live updates without polling. This is an additive change only;
-- it does not modify schema, authentication, or RLS — subscribers still
-- only see rows they're already permitted to read.

alter publication supabase_realtime add table documents;
