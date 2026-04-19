-- Enable Supabase Realtime on documents and chat_messages so spectators
-- (anyone loading a session with ?view=1) can see live updates without
-- polling. Additive change — no schema or RLS modification.

alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table chat_messages;
