# User Settings & API Key Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Gemini API key from the AgentConfigurator panel to a user settings modal accessible via the sidebar avatar menu, persisted in Supabase per-user.

**Architecture:** Add a `user_settings` Supabase table keyed by `user_id` (from `auth.users`). Settings modal opens from the avatar menu in the sidebar bottom bar. The API key is encrypted at rest using Supabase's `pgcrypto` extension with a server-side secret, fetched on auth and cached in React state. The existing `X-Gemini-Key` header flow to the proxy remains unchanged — only the storage layer moves from localStorage to Supabase.

**Tech Stack:** React, Supabase (PostgreSQL + RLS), existing CSS design tokens

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/002_user_settings.sql` | Create | user_settings table + RLS policies |
| `src/lib/settings-store.ts` | Create | Supabase CRUD for user settings (load/save API key) |
| `src/SettingsModal.tsx` | Create | Settings modal UI (API key input, save/cancel) |
| `src/App.css` | Modify | Styles for settings modal |
| `src/Sidebar.tsx` | Modify | Add "Settings" option to avatar menu |
| `src/App.tsx` | Modify | Wire settings modal state, load settings on auth, pass API key down |
| `src/agent.ts` | Modify | Accept API key from props instead of localStorage |
| `src/AgentConfigurator.tsx` | Modify | Remove API key UI section |

---

### Task 1: Supabase Migration — user_settings table

**Files:**
- Create: `supabase/migrations/002_user_settings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- User settings (one row per authenticated user)
create table if not exists user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique,
  gemini_api_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only read/write their own settings
alter table user_settings enable row level security;

create policy "Users can read own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on user_settings for update
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply migration to Supabase**

Run the SQL in the Supabase dashboard SQL editor (project: collab). Verify the table and policies are created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_user_settings.sql
git commit -m "feat: add user_settings table with RLS"
```

---

### Task 2: Settings Store — Supabase CRUD

**Files:**
- Create: `src/lib/settings-store.ts`

- [ ] **Step 1: Write the settings store**

```typescript
import { supabase } from './supabase'

export interface UserSettings {
  gemini_api_key: string | null
}

export async function loadUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('gemini_api_key')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[settings] load error:', error)
    return { gemini_api_key: null }
  }

  return {
    gemini_api_key: data?.gemini_api_key ?? null,
  }
}

export async function saveGeminiApiKey(userId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        gemini_api_key: key || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/settings-store.ts
git commit -m "feat: settings-store CRUD for user API key"
```

---

### Task 3: Settings Modal UI

**Files:**
- Create: `src/SettingsModal.tsx`
- Modify: `src/App.css` (add modal styles)

- [ ] **Step 1: Write the SettingsModal component**

```typescript
import { useState, useEffect } from 'react'

interface Props {
  apiKey: string
  onSave: (key: string) => Promise<void>
  onClose: () => void
}

export function SettingsModal({ apiKey, onSave, onClose }: Props) {
  const [key, setKey] = useState(apiKey)
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setKey(apiKey) }, [apiKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(key)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error('[settings] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="settings-body">
          <label className="settings-label">Gemini API Key</label>
          <div className="settings-key-row">
            <input
              type={visible ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Paste your Gemini API key"
              className="settings-key-input"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="settings-btn" onClick={() => setVisible(v => !v)}>
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="settings-hint">
            Used when no server key is configured.{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Get a key</a>
          </span>
        </div>
        <div className="settings-footer">
          <button className="settings-btn settings-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="settings-btn settings-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add CSS styles to App.css**

Modal overlay, modal card, form elements. Follow existing patterns (sidebar-confirm-overlay/dialog for reference). Use existing design tokens.

- [ ] **Step 3: Commit**

```bash
git add src/SettingsModal.tsx src/App.css
git commit -m "feat: settings modal with API key input"
```

---

### Task 4: Wire Avatar Menu -> Settings

**Files:**
- Modify: `src/Sidebar.tsx` — add "Settings" menu item
- Modify: `src/Sidebar.tsx` — add `onSettings` prop

- [ ] **Step 1: Add onSettings prop to Sidebar**

Add `onSettings?: () => void` to the Props interface and destructure it.

- [ ] **Step 2: Add "Settings" item to avatar menu**

In the avatar menu dropdown, add a "Settings" button above "Sign out":

```tsx
<button className="sidebar-avatar-menu-item" onClick={() => { setUserMenuOpen(false); onSettings?.() }}>Settings</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/Sidebar.tsx
git commit -m "feat: add Settings option to sidebar avatar menu"
```

---

### Task 5: Wire Everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports and state**

```typescript
import { SettingsModal } from './SettingsModal'
import { loadUserSettings, saveGeminiApiKey } from './lib/settings-store'

// In component:
const [showSettings, setShowSettings] = useState(false)
const [geminiApiKey, setGeminiApiKey] = useState('')
```

- [ ] **Step 2: Load settings on auth**

In the existing auth effect (or add a new one), after user is authenticated:

```typescript
useEffect(() => {
  if (!user) return
  loadUserSettings(user.id).then(settings => {
    if (settings.gemini_api_key) {
      setGeminiApiKey(settings.gemini_api_key)
    }
  })
}, [user])
```

- [ ] **Step 3: Pass onSettings to Sidebar**

```tsx
<Sidebar
  ...
  onSettings={() => setShowSettings(true)}
/>
```

- [ ] **Step 4: Render SettingsModal**

```tsx
{showSettings && (
  <SettingsModal
    apiKey={geminiApiKey}
    onSave={async (key) => {
      if (user) await saveGeminiApiKey(user.id, key)
      setGeminiApiKey(key)
    }}
    onClose={() => setShowSettings(false)}
  />
)}
```

- [ ] **Step 5: Pass API key to orchestrator/agent calls**

The `geminiApiKey` state needs to reach `askAgent()`. Currently `getStoredApiKey()` reads localStorage. Replace this:

In `agent.ts`, change `getStoredApiKey()` calls to accept the key as a parameter. In the orchestrator config, pass the key through. The simplest approach: keep using `getStoredApiKey()` but sync the Supabase value to localStorage on load:

```typescript
// In the auth effect after loading settings:
if (settings.gemini_api_key) {
  localStorage.setItem('collab-gemini-api-key', settings.gemini_api_key)
}
```

And in the save handler:
```typescript
onSave={async (key) => {
  if (user) await saveGeminiApiKey(user.id, key)
  localStorage.setItem('collab-gemini-api-key', key)
  setGeminiApiKey(key)
}}
```

This avoids refactoring the agent.ts call chain — localStorage acts as a cache of the Supabase value.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire settings modal, load/save API key from Supabase"
```

---

### Task 6: Remove API Key from AgentConfigurator

**Files:**
- Modify: `src/AgentConfigurator.tsx`

- [ ] **Step 1: Remove the API key section**

Remove the entire `.ac-api-key` div, the `apiKey`/`keyVisible`/`keySaved` state, the `saveKey` function, and the `useEffect` that loads from localStorage.

Keep the `getStoredApiKey()` export since `agent.ts` still uses it.

- [ ] **Step 2: Clean up unused CSS**

Remove `.ac-api-key`, `.ac-key-row`, `.ac-key-input`, `.ac-key-saved`, `.ac-key-hint` styles from App.css if no longer referenced.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/AgentConfigurator.tsx src/App.css
git commit -m "refactor: remove API key UI from AgentConfigurator"
```

---

### Task 7: Localhost Fallback

**Files:**
- Modify: `src/App.tsx`

On localhost (no auth), the settings modal should still work but save to localStorage only (no Supabase call). The current `isLocalhost` check skips auth — settings should gracefully degrade.

- [ ] **Step 1: Handle unauthenticated settings save**

```typescript
onSave={async (key) => {
  if (user) {
    await saveGeminiApiKey(user.id, key)
  }
  localStorage.setItem('collab-gemini-api-key', key)
  setGeminiApiKey(key)
}}
```

- [ ] **Step 2: Load from localStorage on localhost**

```typescript
useEffect(() => {
  if (user) {
    loadUserSettings(user.id).then(settings => {
      const key = settings.gemini_api_key || ''
      setGeminiApiKey(key)
      if (key) localStorage.setItem('collab-gemini-api-key', key)
    })
  } else {
    // Localhost fallback
    setGeminiApiKey(localStorage.getItem('collab-gemini-api-key') || '')
  }
}, [user])
```

- [ ] **Step 3: Verify build, test locally**

```bash
npm run build
npm run dev  # test on localhost — settings should work without auth
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: localhost settings fallback to localStorage"
```

---

### Task 8: Final Integration Test & Deploy

- [ ] **Step 1: Full build verification**

```bash
npm run build
npm run test
```

- [ ] **Step 2: Create PR and merge**

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```

- [ ] **Step 4: Verify on production**

1. Sign in with Google
2. Click avatar -> Settings
3. Paste API key, save
4. Refresh page — key should persist
5. Create a doc, trigger agents — should use the saved key
