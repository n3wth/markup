-- Tighten RLS gaps left by prior migrations.
-- 004_agent_tasks.sql shipped with a permissive "Allow all for anon" policy
-- that grants any caller (including anon) full access to agent_tasks, nullifying
-- the owner-scoped policy on the same table. Drop it so only the owner policy applies.
drop policy if exists "Allow all for anon" on agent_tasks;
