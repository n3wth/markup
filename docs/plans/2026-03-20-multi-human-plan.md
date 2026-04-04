## Plan: Multi-Human Live Collaboration

### Executive Summary

This plan adds real-time multi-user document editing to Markup. The system is built on three pillars: Y.js CRDTs for conflict-free document sync (via Tiptap's collaboration extensions), Hocuspocus as the Y.js WebSocket server (with Supabase persistence), and Supabase Realtime channels for presence, chat sync, and session metadata. The current single-user editor, agent cursor system, and chat system all need structural changes.

### Transport Decision: Hocuspocus over Raw Supabase Realtime

After evaluating both options, Hocuspocus is the right choice for document sync. Here is why:

**Hocuspocus (recommended for Y.js doc transport):**
- Purpose-built Y.js WebSocket server. Handles awareness protocol, document state vectors, incremental updates natively.
- `@hocuspocus/extension-database` provides a clean persistence hook. Wire it to Supabase for storage.
- `@hocuspocus/provider` is the canonical Y.js provider that `@tiptap/extension-collaboration` expects.
- Handles reconnection, offline editing, merge-on-reconnect automatically.
- Battle-tested with Tiptap -- maintained by the same team.

**Supabase Realtime (for presence and chat only):**
- Supabase Realtime channels are excellent for presence tracking and lightweight pub/sub (chat messages, typing indicators, session metadata).
- They are *not* designed as Y.js transport. Building a custom Y.js provider on top of Supabase broadcast would mean reimplementing awareness protocol, state vector exchange, and incremental sync. This is fragile and unmaintained territory.

**Architecture split:**
- Hocuspocus WebSocket server handles document CRDT sync (Y.js updates, awareness).
- Supabase Realtime channels handle presence (who's online, cursor positions outside doc), chat message broadcast, and typing indicators.
- Supabase Postgres stores Y.js document state (binary snapshots), chat messages, and session metadata.

### Dependency Changes

Tiptap core must be bumped from `3.20.1` to `3.20.4` because `@tiptap/extension-collaboration-cursor@3.0.0` requires `^3.20.4`.

**New dependencies:**
```
# Client-side
yjs@^13.6.30
@tiptap/extension-collaboration@^3.20.4
@tiptap/extension-collaboration-cursor@^3.0.0
@hocuspocus/provider@^3.4.4

# Server-side (Hocuspocus server -- separate package or Vercel serverless)
@hocuspocus/server@^3.4.4
@hocuspocus/extension-database@^3.4.4
```

**Bumped:**
```
@tiptap/react@^3.20.4
@tiptap/starter-kit@^3.20.4
@tiptap/extension-placeholder@^3.20.4
@tiptap/core@^3.20.4
@tiptap/pm@^3.20.4
```

### Phase 1: Schema Changes

**New migration: `supabase/migrations/003_multiplayer.sql`**

```sql
-- Session members (who has access to a session)
create table if not exists session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  display_name text not null,
  avatar_url text,
  color text not null default '#1a1a1a',
  joined_at timestamptz not null default now(),
  unique(session_id, user_id)
);

create index idx_session_members_session on session_members(session_id);
create index idx_session_members_user on session_members(user_id);

-- RLS: members can read their own session membership, owners can manage
alter table session_members enable row level security;

create policy "Members can read session members"
  on session_members for select
  using (
    session_id in (
      select session_id from session_members where user_id = auth.uid()
    )
  );

create policy "Authenticated users can join sessions"
  on session_members for insert
  with check (auth.uid() = user_id);

create policy "Owners can update members"
  on session_members for update
  using (
    session_id in (
      select session_id from session_members where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "Members can leave (delete self)"
  on session_members for delete
  using (auth.uid() = user_id);

-- Add owner_id to sessions (nullable for backward compat)
alter table sessions add column if not exists owner_id uuid references auth.users(id);

-- Add share_token for invite links (random URL-safe token)
alter table sessions add column if not exists share_token text unique;

-- Y.js document state (binary, replaces html_snapshot for collab)
alter table documents add column if not exists yjs_state bytea;

-- Update chat_messages to reference user_id (nullable for agents/system)
alter table chat_messages add column if not exists user_id uuid references auth.users(id);
alter table chat_messages add column if not exists sender_color text;

-- Tighten RLS on sessions: only members or public sessions (share_token not null)
drop policy if exists "public_sessions" on sessions;

create policy "Members can read sessions"
  on sessions for select
  using (
    id in (select session_id from session_members where user_id = auth.uid())
    or share_token is not null
    or owner_id is null -- backward compat for existing sessions with no owner
  );

create policy "Authenticated users can create sessions"
  on sessions for insert
  with check (auth.uid() is not null);

create policy "Owners can update sessions"
  on sessions for update
  using (
    owner_id = auth.uid()
    or owner_id is null
  );

create policy "Owners can delete sessions"
  on sessions for delete
  using (
    owner_id = auth.uid()
    or owner_id is null
  );

-- Update documents RLS
drop policy if exists "public_documents" on documents;

create policy "Members can access documents"
  on documents for all
  using (
    session_id in (select session_id from session_members where user_id = auth.uid())
    or session_id in (select id from sessions where owner_id is null)
    or session_id in (select id from sessions where share_token is not null)
  );

-- Update chat_messages RLS
drop policy if exists "public_chat" on chat_messages;

create policy "Members can access chat"
  on chat_messages for all
  using (
    session_id in (select session_id from session_members where user_id = auth.uid())
    or session_id in (select id from sessions where owner_id is null)
    or session_id in (select id from sessions where share_token is not null)
  );

-- Function to generate share tokens
create or replace function generate_share_token()
returns text as $$
  select encode(gen_random_bytes(16), 'base64url')
$$ language sql;
```

### Phase 2: Hocuspocus Server

The Hocuspocus server runs as a standalone Node process. For Vercel deployment, this needs a separate long-running server (Vercel serverless functions cannot hold WebSocket connections). Options: Railway, Fly.io, or a small VPS. For development, it runs locally alongside the Vite dev server.

**New file: `server/hocuspocus.ts`**

This file creates the Hocuspocus server with:
- `@hocuspocus/extension-database` for persistence. On `fetch`, load `yjs_state` bytea from Supabase `documents` table. On `store`, save the Y.js update back.
- Authentication hook: validate the Supabase JWT passed as a connection parameter. Reject unauthorized connections.
- `onConnect` hook: verify user is a session member (query `session_members` table).
- Port: configurable, default 1234.

```
server/
  hocuspocus.ts        -- server entry
  package.json         -- separate deps (hocuspocus/server, supabase-js, etc.)
```

The Hocuspocus server needs a Supabase service-role key for server-side database access (not the anon key). This is set via `SUPABASE_SERVICE_ROLE_KEY` env var.

**Key implementation details for `server/hocuspocus.ts`:**
- Document name convention: `session:{sessionId}` -- the `documentName` in Hocuspocus maps to a session ID.
- The `onAuthenticate` hook extracts the Supabase JWT from `connection.token`, verifies it using `supabase.auth.getUser(token)`, then checks `session_members` for access.
- The Database extension fetches `yjs_state` from the `documents` table on connect and writes it back on disconnect or every 10 seconds (debounced).
- Awareness data (cursor positions, user info) is handled natively by Hocuspocus -- no custom code needed.

### Phase 3: Y.js + Tiptap Collaboration Setup (Client)

**Modified file: `src/App.tsx`**

The editor setup changes substantially. Currently the editor is created with `useEditor` and `StarterKit`. The new setup adds `Collaboration` and `CollaborationCursor` extensions.

Key changes to `src/App.tsx`:
1. Import `HocuspocusProvider` from `@hocuspocus/provider`.
2. Import `Collaboration` from `@tiptap/extension-collaboration`.
3. Import `CollaborationCursor` from `@tiptap/extension-collaboration-cursor`.
4. Create a `HocuspocusProvider` instance when a session is opened (in `useSession` or a new `useCollaboration` hook). Pass the session ID as the document name and the user's Supabase JWT as the auth token.
5. Replace `StarterKit`'s built-in `history` (undo/redo) with Y.js-based undo. The `Collaboration` extension replaces ProseMirror's history plugin. Pass `history: false` to `StarterKit`.
6. Remove the `AgentCursors` custom extension -- it will be replaced by `CollaborationCursor` for both humans and agents (see Phase 4).
7. Remove the debounced `saveDocument()` call in `onUpdate` -- Y.js handles persistence through Hocuspocus.

**New hook: `src/hooks/useCollaboration.ts`**

This hook manages the Hocuspocus provider lifecycle:
- Creates `HocuspocusProvider` when `activeSession` is set.
- Passes `url` (Hocuspocus WebSocket URL), `name` (session ID), `token` (Supabase JWT from `useAuth`).
- Sets awareness local state with user info: `{ name, color, avatarUrl }`.
- Returns the `provider` and `ydoc` for the editor extensions.
- Cleans up on session change or unmount (provider.disconnect).
- Exposes connection status for UI display (connected, connecting, disconnected).

```typescript
// Pseudocode shape:
function useCollaboration(sessionId: string | null, user: User | null) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    if (!sessionId || !user) return
    const ydoc = new Y.Doc()
    const p = new HocuspocusProvider({
      url: import.meta.env.VITE_HOCUSPOCUS_URL || 'ws://localhost:1234',
      name: `session:${sessionId}`,
      document: ydoc,
      token: /* supabase JWT */,
      onConnect: () => setStatus('connected'),
      onDisconnect: () => setStatus('disconnected'),
    })
    setProvider(p)
    return () => { p.disconnect(); p.destroy() }
  }, [sessionId, user])

  return { provider, status }
}
```

**Modified editor setup in `src/App.tsx`:**

The `useEditor` call changes to include collaboration extensions:

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ history: false }), // Y.js replaces history
    Placeholder.configure({ ... }),
    Collaboration.configure({ document: provider?.document }),
    CollaborationCursor.configure({
      provider: provider,
      user: { name: user?.email || 'Anonymous', color: userColor },
    }),
    DocMinimap.configure({ ... }),
  ],
  // Remove content: EMPTY_DOC -- Y.js handles initial content
}, [provider]) // re-create editor when provider changes
```

**Critical migration concern:** Existing documents are stored as `html_snapshot` in the `documents` table. When a session is first opened in collab mode and there is no `yjs_state` but there is an `html_snapshot`, the Hocuspocus server's `onLoadDocument` hook must:
1. Create a new Y.Doc.
2. Use `yjs`'s ProseMirror bindings to import the HTML into the Y.Doc.
3. Return the Y.Doc state for the initial sync.
4. Save the Y.js state to `yjs_state` column.

This one-time migration happens per-document on first collab access.

### Phase 4: Multi-Cursor with User Identification

**Remove: `src/agent-cursor.ts`** (the custom ProseMirror plugin)

The current `agent-cursor.ts` is a custom ProseMirror decoration plugin that manages agent cursor positions manually via `setAgentCursor` / `removeAgentCursor` commands. This must be replaced.

`@tiptap/extension-collaboration-cursor` handles cursor rendering for all connected users via Y.js awareness. Both humans and agents can set their awareness state.

**Cursor rendering customization:**

The `CollaborationCursor` extension accepts a `render` function that returns the DOM elements for each cursor. Reuse the existing blob avatar design from `agent-cursor.ts` for agents, and use a simpler colored cursor + name label for humans.

```typescript
CollaborationCursor.configure({
  provider,
  user: { name, color, avatarUrl, isAgent: false },
  render: (user) => {
    const cursor = document.createElement('span')
    cursor.classList.add('collab-cursor')
    cursor.style.borderColor = user.color

    const label = document.createElement('span')
    label.classList.add('collab-cursor-label')
    label.style.backgroundColor = user.color
    label.textContent = user.name

    cursor.appendChild(label)
    return cursor
  },
})
```

**Color assignment:** Each user gets a deterministic color derived from their user ID (hash to color palette). Store the assigned color in `session_members.color`. The palette avoids collisions with agent colors (`#30d158`, `#ff6961`, `#64d2ff`, `#ffd60a`).

**User color palette** (distinct from agent colors):
```
#a78bfa  (violet)
#f472b6  (pink)
#fb923c  (orange)
#34d399  (emerald)
#60a5fa  (blue)
#fbbf24  (amber)
#e879f9  (fuchsia)
#4ade80  (green)
```

### Phase 5: Agent Cursor Adaptation

Agents are not WebSocket clients -- they run server-side (API calls from the browser). Agent cursors need to be set via the local user's awareness, not via a separate agent WebSocket connection.

**Approach:** The orchestrator still runs in the browser. When an agent acts, the client sets a "virtual" awareness state for the agent. Hocuspocus awareness protocol allows setting state for arbitrary client IDs.

**Modified: `src/agent-actions.ts`**

Replace all `editor.commands.setAgentCursor(...)` and `editor.commands.removeAgentCursor(...)` calls with awareness updates:

```typescript
// Instead of custom cursor commands:
provider.awareness.setLocalStateField(`agent:${agentName}`, {
  cursor: { anchor: pos, head: pos },
  user: { name: agentName, color: agentColor, isAgent: true },
})
```

However, this is tricky because awareness is per-client. A better approach: create ephemeral Y.js awareness entries. The provider allows `awareness.setLocalStateField` but only for the local client. For agents, use a dedicated shared Y.js map:

**Alternative (simpler):** Keep agent cursors as a Y.js shared type. Create a `Y.Map` named `agentCursors` in the Y.Doc. Each agent writes its cursor state to this map. A custom Tiptap extension reads this map and renders decorations (similar to the current `agent-cursor.ts` but backed by Y.js for multi-user sync).

```typescript
// In the Y.Doc:
const agentCursors = ydoc.getMap('agentCursors')
agentCursors.set('Aiden', { pos: 42, color: '#30d158', thought: 'Writing...' })

// Custom extension reads this map and renders decorations
// This syncs automatically across all connected clients via Y.js
```

This approach keeps agent cursors visible to all connected humans without creating fake WebSocket connections. The existing `agent-cursor.ts` rendering logic (blob canvas, thought bubbles) can be preserved in the new Y.js-backed extension.

**New file: `src/agent-cursor-collab.ts`**

A Tiptap extension that:
1. Observes `ydoc.getMap('agentCursors')` for changes.
2. Renders ProseMirror decorations identical to the current `agent-cursor.ts` output.
3. When an agent action updates cursor state, the orchestrator writes to the Y.Map.
4. All connected clients see the update via Y.js sync.

### Phase 6: Chat Message Real-Time Sync

Currently chat messages are stored in Supabase via `saveChatMessage()` and loaded on session open via `loadChatMessages()`. There is no live sync -- if user B sends a message, user A does not see it until page reload.

**New file: `src/hooks/useChatSync.ts`**

Uses Supabase Realtime to subscribe to `chat_messages` inserts:

```typescript
function useChatSync(sessionId: string | null) {
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const msg = payload.new as ChatMessageRecord
        // Add to local messages state (deduplicate by ID)
        addMessage(msg)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])
}
```

**Modified: `src/hooks/useOrchestrator.ts` and `src/App.tsx`**

The `onChatMessage` callback currently only updates local React state and calls `saveChatMessage`. With Realtime, the insert to Supabase triggers the Realtime subscription, which adds the message to all clients. To avoid duplicates on the sending client, either:
- Use a message ID set and skip messages already in local state, or
- Only add messages from the Realtime subscription (remove the local `setMessages` in `onChatMessage`). This adds latency for the sender but simplifies dedup.

Recommended: keep the local optimistic add (for sender responsiveness) and deduplicate on Realtime receipt by checking `msg.id`.

### Phase 7: Presence System

**New file: `src/hooks/usePresence.ts`**

Uses Supabase Realtime Presence to track who is online in a session:

```typescript
interface PresenceState {
  userId: string
  displayName: string
  avatarUrl: string
  color: string
  isTyping: boolean
  lastSeen: string
}

function usePresence(sessionId: string | null, user: User | null) {
  const [presences, setPresences] = useState<PresenceState[]>([])

  useEffect(() => {
    if (!sessionId || !user) return

    const channel = supabase.channel(`presence:${sessionId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        setPresences(Object.values(state).flat())
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            displayName: user.user_metadata?.name || user.email || 'Anonymous',
            avatarUrl: user.user_metadata?.avatar_url || '',
            color: assignedColor,
            isTyping: false,
            lastSeen: new Date().toISOString(),
          })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, user])

  const setTyping = (isTyping: boolean) => {
    channel.track({ ...currentState, isTyping })
  }

  return { presences, setTyping }
}
```

**UI changes in `src/components/SessionHeader.tsx`:**

Add a presence bar showing avatars of connected users. Each user gets a colored ring around their avatar. Typing indicators show as a pulsing dot next to the user's avatar.

The current `SessionHeader` shows agent blob avatars with status. Add a new section before the agent avatars showing human collaborators.

### Phase 8: Shareable Session URLs with Auth

**URL scheme:** Sessions are already accessible at `/s/{sessionId}`. For sharing, add an invite flow:

1. Session owner clicks "Share" button -> generates a share token (stored in `sessions.share_token`).
2. Share URL format: `https://markup.so/s/{sessionId}?invite={shareToken}`.
3. When a user opens a share URL:
   - If authenticated: check `session_members`. If not a member, validate the `invite` token against `sessions.share_token`. If valid, insert a `session_members` row with `role='editor'` and proceed.
   - If not authenticated: redirect to login (existing Google OAuth flow), then process the invite on return.

**New file: `src/lib/session-invite.ts`**

```typescript
export async function joinSession(sessionId: string, shareToken: string, user: User): Promise<boolean> {
  // Verify share token
  const { data: session } = await supabase
    .from('sessions')
    .select('share_token')
    .eq('id', sessionId)
    .single()

  if (!session || session.share_token !== shareToken) return false

  // Add user as member
  const { error } = await supabase.from('session_members').upsert({
    session_id: sessionId,
    user_id: user.id,
    role: 'editor',
    display_name: user.user_metadata?.name || user.email || 'Anonymous',
    avatar_url: user.user_metadata?.avatar_url || null,
    color: assignColor(user.id),
  }, { onConflict: 'session_id,user_id' })

  return !error
}

export async function generateShareToken(sessionId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await supabase.from('sessions').update({ share_token: token }).eq('id', sessionId)
  return token
}
```

**Modified: `src/hooks/useSession.ts`**

The URL routing in `useEffect` must check for `?invite=` query parameter. If present, call `joinSession` before `handleSessionSelect`.

**New UI component: `src/components/ShareDialog.tsx`**

Modal triggered from session header. Shows:
- Copy link button (generates share token if none exists).
- List of current members with roles.
- Remove member button (for owner).

### Phase 9: Agent Awareness of Multiple Humans

**Modified: `src/agent.ts` -- `buildPrompt()`**

The prompt currently addresses a single user as `params.ownerName`. With multiple humans, the prompt must list all connected users.

Changes to `AskParams`:
```typescript
export interface AskParams {
  // ... existing fields ...
  connectedUsers?: { name: string, color: string }[]  // all humans currently online
}
```

Changes to `buildPrompt()`:
- Replace `the user (${params.ownerName})` with a list of connected users.
- Include which user sent the most recent message.
- Add a collaboration context section:

```
CONNECTED USERS:
- Oliver (owner, #a78bfa) -- last spoke 30s ago
- Sarah (#f472b6) -- typing

When addressing a specific user, use their name. When multiple users have given conflicting instructions, weigh both inputs and explain your reasoning for the direction you chose.
```

**Modified: `src/orchestrator.ts`**

The orchestrator's `trigger('user-message')` must track which user sent the message (not just "You"). This affects:
- The `instruction` string passed to agents (prefix with user name).
- The `chatHistory` array (use real user names instead of "You").

Changes to the `onMessage` handler in the orchestrator config:
```typescript
// Currently:
onChatMessage: (from, text) => { ... }
// Now also receives user ID for attribution:
// The 'from' field should be the user's display name, not "You"
```

**Conflict resolution:** When agents detect conflicting instructions from different users, the prompt instructs them to:
1. Acknowledge both perspectives.
2. Synthesize where possible.
3. Explain the tradeoff if a choice must be made.
4. Ask for consensus if the conflict is fundamental.

This is a prompt-level change in `buildPrompt()`, not architectural.

### Phase 10: Document Save Path Changes

**Current:** `App.tsx` `onUpdate` debounces `saveDocument(sessionId, html)` which upserts HTML into the `documents` table.

**New:** Y.js handles persistence through Hocuspocus. The `saveDocument` call is removed from `onUpdate`. The Hocuspocus server's Database extension writes `yjs_state` to Supabase.

**Backward compatibility:** Keep `html_snapshot` updated alongside `yjs_state` for non-collab features (export, preview, Google Drive sync). Add a server-side hook that generates HTML from the Y.Doc on save.

**Modified: `src/lib/session-store.ts`**
- `saveDocument()` is no longer called from the client for collab sessions. Keep it for non-collab fallback.
- `loadDocument()` remains for initial HTML display before Y.js connects.
- Add `createSessionWithOwner(title, template, userId)` that also inserts the owner into `session_members`.

### Implementation Order

1. **Schema migration** (`003_multiplayer.sql`) -- foundation for everything.
2. **Hocuspocus server** (`server/hocuspocus.ts`) -- document sync backend.
3. **Client collaboration setup** (`useCollaboration.ts`, editor changes in `App.tsx`) -- Y.js wired to editor.
4. **Agent cursor migration** (`agent-cursor-collab.ts`, changes to `agent-actions.ts`) -- agents visible in collab.
5. **Chat sync** (`useChatSync.ts`) -- real-time chat across clients.
6. **Presence** (`usePresence.ts`, SessionHeader changes) -- who's online.
7. **Share/invite flow** (`session-invite.ts`, `ShareDialog.tsx`, useSession changes) -- URL sharing.
8. **Agent multi-human awareness** (prompt changes in `agent.ts`, orchestrator changes) -- agents address users by name.

Steps 1-3 are the critical path. Steps 4-8 can be parallelized after step 3.

### Risks and Mitigations

**Risk: Hocuspocus hosting.** Vercel cannot host persistent WebSocket connections. Mitigation: deploy Hocuspocus on Railway or Fly.io. The server is lightweight (single Node process). Set `VITE_HOCUSPOCUS_URL` env var per environment.

**Risk: Tiptap version bump.** Bumping from 3.20.1 to 3.20.4 may introduce breaking changes. Mitigation: these are patch versions, low risk. Run full test suite after bump.

**Risk: Existing sessions have no owner.** The schema adds `owner_id` as nullable. Existing sessions continue to work with permissive RLS fallbacks (`owner_id is null`). First user to open an existing session should be prompted to claim ownership.

**Risk: Agent cursor approach.** Using a Y.Map for agent cursors is non-standard. If it causes sync issues, fall back to Hocuspocus awareness with a dedicated agent "client" running server-side.

**Risk: Chat dedup with Realtime.** Optimistic local adds + Realtime subscription creates duplicate potential. Mitigation: deduplicate by message `id` in the `setMessages` reducer.

### Critical Files for Implementation

- `/Users/oliver/GitHub/markup/src/App.tsx` - Core editor setup must be rewritten to use Collaboration + CollaborationCursor extensions instead of standalone editor with custom cursors. The `onUpdate` save path, editor initialization, and session lifecycle all change here.
- `/Users/oliver/GitHub/markup/src/agent-cursor.ts` - Must be replaced by `agent-cursor-collab.ts` that reads from Y.js shared map instead of local ProseMirror plugin state. The rendering logic (blob canvas, thought bubbles) carries over but the data source changes completely.
- `/Users/oliver/GitHub/markup/src/lib/session-store.ts` - Needs new functions for session membership CRUD, share token generation, and session creation with owner. The `saveDocument` path changes from client-driven HTML upsert to server-driven Y.js state persistence.
- `/Users/oliver/GitHub/markup/src/agent.ts` - The `buildPrompt` function and `AskParams` interface must be extended with connected users list and multi-human collaboration instructions for conflict resolution.
- `/Users/oliver/GitHub/markup/supabase/migrations/001_initial_schema.sql` - Reference for the new `003_multiplayer.sql` migration. The new migration adds `session_members`, modifies `sessions` and `documents` tables, and tightens RLS policies from permissive to membership-based.