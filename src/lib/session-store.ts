import { supabase } from './supabase'
import type {
  Session,
  DocTemplate,
  AgentPersonaRecord,
  ChatMessageRecord,
  AgentTask,
} from '../types'

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id ?? null
}

// Retry helper for transient network failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
      }
    }
  }
  throw lastError
}

/* Sessions */

const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export async function createSession(
  title: string,
  template: DocTemplate,
): Promise<Session> {
  const userId = await getCurrentUserId()
  const row: Record<string, unknown> = { title, template }
  if (userId) row.user_id = userId
  const { data, error } = await supabase
    .from('sessions')
    .insert(row)
    .select()
    .single()
  if (error) {
    if (isLocalDev) {
      const now = new Date().toISOString()
      return { id: crypto.randomUUID(), user_id: null, title, template, created_at: now, updated_at: now }
    }
    throw error
  }
  return data
}

export async function listSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) {
    if (isLocalDev) return []
    throw error
  }
  return data || []
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}

export interface SearchHit {
  session_id: string
  document_id: string | null
  title: string
  updated_at: string
  rank: number
}

export async function searchDocuments(
  query: string,
  maxResults = 20,
): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const { data, error } = await supabase.rpc('search_documents', {
    q: trimmed,
    max_results: maxResults,
  })
  if (error) {
    if (isLocalDev) return []
    throw error
  }
  return (data as SearchHit[] | null) || []
}

/* Documents */

export async function saveDocument(
  sessionId: string,
  html: string,
): Promise<void> {
  await withRetry(async () => {
    const { error } = await supabase
      .from('documents')
      .upsert(
        {
          session_id: sessionId,
          html_snapshot: html,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' },
      )
    if (error) throw error
  })
}

export async function loadDocument(
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('html_snapshot')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error || !data) return null
  return data.html_snapshot
}

/**
 * Subscribe to live document updates via Supabase Realtime. Used by
 * already-authorized clients in view mode (for example, a session loaded
 * with ?view=1) to follow the author's edits without polling. Access is
 * still enforced by RLS — subscribers only receive rows they can read.
 *
 * Two transports feed `onChange`:
 *  - `postgres_changes` on `documents`: fires on every debounced save
 *    (~2s cadence). Durable: a late-joining spectator gets caught up
 *    the next time the author persists.
 *  - `broadcast` event `doc-edit`: fires on every throttled keystroke
 *    (~300ms cadence) from `publishDocumentEdit`. Ephemeral, but tight
 *    enough that the spectator sees the author type character-by-chunk.
 *
 * The spectator side is idempotent on HTML equality, so overlapping
 * deliveries from the two channels are harmless.
 *
 * Returns an unsubscribe function.
 */
export function subscribeToDocument(
  sessionId: string,
  onChange: (html: string) => void,
): () => void {
  const channel = supabase
    .channel(`doc-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        const next = (payload.new as { html_snapshot?: string } | null)?.html_snapshot
        if (typeof next === 'string') onChange(next)
      },
    )
    .on(
      'broadcast',
      { event: 'doc-edit' },
      (payload) => {
        const next = (payload?.payload as { html?: string } | undefined)?.html
        if (typeof next === 'string') onChange(next)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Cache of broadcast-only publisher channels keyed by session id. Kept
 * separate from the subscriber channel in {@link subscribeToDocument} so
 * the author doesn't accidentally subscribe to their own
 * `postgres_changes` stream and echo saves back into the editor.
 */
const broadcastChannels = new Map<string, ReturnType<typeof supabase.channel>>()

function getBroadcastChannel(sessionId: string): ReturnType<typeof supabase.channel> {
  const existing = broadcastChannels.get(sessionId)
  if (existing) return existing
  const channel = supabase.channel(`doc-edit-${sessionId}`, {
    config: { broadcast: { self: false, ack: false } },
  })
  channel.subscribe()
  broadcastChannels.set(sessionId, channel)
  return channel
}

/**
 * Broadcast the author's current HTML to spectators via Supabase
 * Realtime broadcast. Intended to be called on every editor update,
 * with the caller throttling to a sensible cadence (~300ms) so we
 * don't flood the channel on fast typing.
 *
 * Broadcast is fire-and-forget: no persistence, no delivery guarantee.
 * The debounced `saveDocument` path remains the source of truth — this
 * only exists to close the ~2s visible gap between keystroke and save
 * for already-connected spectators.
 */
export function publishDocumentEdit(sessionId: string, html: string): void {
  const channel = getBroadcastChannel(sessionId)
  // channel.send is async but we don't await — broadcast is best-effort.
  void channel.send({ type: 'broadcast', event: 'doc-edit', payload: { html } })
}

/**
 * Tear down the broadcast publisher for a session. Call when the author
 * leaves the doc (session switch, unmount) so the channel doesn't leak.
 */
export function closeDocumentBroadcast(sessionId: string): void {
  const channel = broadcastChannels.get(sessionId)
  if (!channel) return
  broadcastChannels.delete(sessionId)
  supabase.removeChannel(channel)
}

/* Chat Messages */

export async function saveChatMessage(
  sessionId: string,
  msg: { sender: string; text: string; reasoning?: string[] },
): Promise<ChatMessageRecord> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender: msg.sender,
        text: msg.text,
        reasoning: msg.reasoning || null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function loadChatMessages(
  sessionId: string,
): Promise<ChatMessageRecord[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/* Agent Personas */

export async function saveAgentPersonas(
  sessionId: string,
  personas: Omit<AgentPersonaRecord, 'id' | 'session_id'>[],
): Promise<void> {
  await withRetry(async () => {
    const { error: delError } = await supabase
      .from('agent_personas')
      .delete()
      .eq('session_id', sessionId)
    if (delError) throw delError

    if (personas.length === 0) return

    const rows = personas.map((p, i) => ({
      session_id: sessionId,
      name: p.name,
      description: p.description,
      system_prompt: p.system_prompt,
      color: p.color,
      owner: p.owner,
      model: p.model,
      sort_order: i,
    }))
    const { error } = await supabase.from('agent_personas').insert(rows)
    if (error) throw error
  })
}

export async function loadAgentPersonas(
  sessionId: string,
): Promise<AgentPersonaRecord[]> {
  const { data, error } = await supabase
    .from('agent_personas')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

/* Agent Tasks */

export async function saveAgentTasks(
  sessionId: string,
  tasks: Omit<AgentTask, 'id' | 'createdAt' | 'completedAt'>[],
): Promise<AgentTask[]> {
  return withRetry(async () => {
    const rows = tasks.map(t => ({
      session_id: sessionId,
      title: t.title,
      status: t.status,
      assigned_agents: t.assignedAgents,
      created_by: t.createdBy,
      section_anchor: t.sectionAnchor || null,
      sort_order: t.order,
      completed_by: t.completedBy || null,
    }))
    const { data, error } = await supabase
      .from('agent_tasks')
      .insert(rows)
      .select()
    if (error) {
      if (isLocalDev) {
        return tasks.map((t) => ({
          id: crypto.randomUUID(),
          sessionId,
          title: t.title,
          status: t.status,
          assignedAgents: t.assignedAgents,
          createdBy: t.createdBy,
          sectionAnchor: t.sectionAnchor,
          order: t.order,
          completedBy: t.completedBy,
          createdAt: new Date().toISOString(),
        })) as AgentTask[]
      }
      throw error
    }
    return (data || []).map(mapTaskRow)
  })
}

export async function loadAgentTasks(
  sessionId: string,
): Promise<AgentTask[]> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('session_id', sessionId)
    .order('sort_order', { ascending: true })
  if (error) {
    if (isLocalDev) return []
    throw error
  }
  return (data || []).map(mapTaskRow)
}

export async function updateAgentTask(
  taskId: string,
  patch: Partial<Pick<AgentTask, 'status' | 'title' | 'assignedAgents' | 'completedBy' | 'order'>>,
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.title !== undefined) row.title = patch.title
  if (patch.assignedAgents !== undefined) row.assigned_agents = patch.assignedAgents
  if (patch.completedBy !== undefined) row.completed_by = patch.completedBy
  if (patch.order !== undefined) row.sort_order = patch.order
  if (patch.status === 'complete') row.completed_at = new Date().toISOString()

  await withRetry(async () => {
    const { error } = await supabase
      .from('agent_tasks')
      .update(row)
      .eq('id', taskId)
    if (error && !isLocalDev) throw error
  })
}

/** Map a Supabase row (snake_case) to our AgentTask interface (camelCase) */
function mapTaskRow(row: Record<string, unknown>): AgentTask {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    title: row.title as string,
    status: row.status as AgentTask['status'],
    assignedAgents: (row.assigned_agents as string[]) || [],
    createdBy: row.created_by as string,
    sectionAnchor: row.section_anchor as string | undefined,
    order: row.sort_order as number,
    completedBy: row.completed_by as string | undefined,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined,
  }
}
