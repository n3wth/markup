# Wave 1 PRD — Product depth (Quadrant A)

> This is a stub. Full PRD to be generated via ChatPRD MCP at wave-entry time and pasted here.

## Wave goal

markup is usable for real work. Projects, sharing, export, history, organization.

## Tasks in scope

### Track A1: Project model (~8 PRs)

- **W1-T001** Migration: `projects` table + `sessions.project_id` FK + backfill
- **W1-T002** Supabase RLS policies for `projects`
- **W1-T003** Session-store: `loadProjects`, `createProject`, `renameProject`, `archiveProject`
- **W1-T004** HomeDashboard: project-scoped view + project switcher
- **W1-T005** Sidebar: project tree (collapse/expand, drag to reorder)
- **W1-T006** Move session between projects
- **W1-T007** Archive / restore session
- **W1-T008** Project-level agent persona defaults (inherit into sessions)

### Track A2: Sharing + permissions (~7 PRs)

- **W1-T009** Migration: `session_shares` table (role: viewer/commenter/editor) + RLS
- **W1-T010** Share-link generation: signed-URL style tokens, expire-after toggle
- **W1-T011** Share modal UI (invite by email, copy link, manage shares)
- **W1-T012** Commenter role: read doc + chat, comment-only insertions
- **W1-T013** Editor role: same as owner, minus delete-session
- **W1-T014** Revoke access
- **W1-T015** Shared-with-me view on HomeDashboard

### Track A3: Real-time multiplayer human ↔ human (~5 PRs)

- **W1-T016** Extend existing Realtime-documents (#209) to broadcast human edits too (not just agent)
- **W1-T017** Human presence in doc: colored cursor, name chip, reuse agent-cursor decoration layer
- **W1-T018** Conflict resolution: last-write-wins per node, warn on simultaneous edit within 2s
- **W1-T019** Out-of-sync indicator + force-reconnect
- **W1-T020** Multi-human + multi-agent visible in same doc

### Track A4: Export (~5 PRs)

- **W1-T021** Export to Markdown (serialize Tiptap to MD via existing rules)
- **W1-T022** Export to HTML (standalone page with doc content)
- **W1-T023** Export to PDF (server-rendered via Vercel function with playwright-style renderer)
- **W1-T024** Snapshot URL: frozen HTML view, shareable, indexed
- **W1-T025** Export modal + format picker + trigger

### Track A5: Version history (~5 PRs)

- **W1-T026** Migration: `document_snapshots` table (doc_id, content jsonb, created_at, author)
- **W1-T027** Snapshot on save (debounced to 5m per doc) and on major milestones (agent finishes plan, user hits save-snapshot)
- **W1-T028** History panel UI: list of snapshots with timestamps and authors
- **W1-T029** Diff view: two snapshots side-by-side, Tiptap-aware diff highlighting
- **W1-T030** Restore snapshot (creates new snapshot, applies content)

### Track A6: Search + org (~4 PRs)

- **W1-T031** Full-text search across user's docs (postgres tsvector on content and title)
- **W1-T032** Search UI + command palette
- **W1-T033** Keyboard shortcuts: jump to doc, new doc, open search
- **W1-T034** Recent docs list on HomeDashboard, sorted by last-modified

## User stories

_To be populated by ChatPRD._

## Acceptance criteria per task

_To be populated by ChatPRD. One block per task ID above._

## Success metrics

_To be populated by ChatPRD._

## Open questions

_To be populated by ChatPRD._
