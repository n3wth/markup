import { supabase } from '../lib/supabase'

export interface AgentJournalEntry {
  id: string
  project_id: string
  agent_id: string
  session_id: string | null
  entry_text: string
  created_at: string
}

/**
 * Append a single journal entry for an agent within a project. The
 * caller (orchestrator) decides when to call this — typically after a
 * turn completes and the model has produced a `memoryText` reflection.
 *
 * Empty / whitespace-only `entryText` is a no-op so callers can pass
 * `action.memoryText` without first checking it. Network/RLS errors
 * are logged and swallowed: a journal write must never break a turn.
 */
export async function appendEntry(
  projectId: string,
  agentId: string,
  sessionId: string | null,
  entryText: string,
): Promise<AgentJournalEntry | null> {
  const text = entryText?.trim()
  if (!text || !projectId || !agentId) return null

  const { data, error } = await supabase
    .from('agent_journal_entries')
    .insert({
      project_id: projectId,
      agent_id: agentId,
      session_id: sessionId,
      entry_text: text,
    })
    .select()
    .single()

  if (error) {
    console.warn('[agent-journal] appendEntry failed:', error.message)
    return null
  }
  return data as AgentJournalEntry
}

/**
 * Most recent journal entries for an agent in a project, newest first.
 * Used by later beads to inject prior context into the agent prompt.
 * Returns an empty array on error so callers can treat "no memory" and
 * "memory unavailable" the same.
 */
export async function recentEntries(
  projectId: string,
  agentId: string,
  limit = 10,
): Promise<AgentJournalEntry[]> {
  if (!projectId || !agentId) return []

  const { data, error } = await supabase
    .from('agent_journal_entries')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[agent-journal] recentEntries failed:', error.message)
    return []
  }
  return (data || []) as AgentJournalEntry[]
}
