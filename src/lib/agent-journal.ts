import { supabase } from './supabase'

export interface JournalEntry {
  id: string
  project_id: string
  agent_id: string
  session_id: string
  entry_text: string
  created_at: string
}

/**
 * Append a memory entry for an agent after a turn.
 * Returns the inserted row, or null on auth/network failure (non-throwing).
 */
export async function appendEntry(
  projectId: string,
  agentId: string,
  sessionId: string,
  entryText: string,
): Promise<JournalEntry | null> {
  if (!entryText.trim()) return null
  const { data, error } = await supabase
    .from('agent_journal_entries')
    .insert({ project_id: projectId, agent_id: agentId, session_id: sessionId, entry_text: entryText.slice(0, 2000) })
    .select()
    .single()
  if (error) {
    console.warn('[agent-journal] appendEntry failed:', error.message)
    return null
  }
  return data as JournalEntry
}

/**
 * Fetch the N most recent journal entries for an agent in a project.
 * Returns entries oldest-first so they read naturally in a prompt.
 */
export async function recentEntries(
  projectId: string,
  agentId: string,
  limit = 10,
): Promise<JournalEntry[]> {
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
  // Reverse so oldest-first for prompt injection
  return ((data as JournalEntry[]) || []).reverse()
}
