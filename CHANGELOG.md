# Changelog

Markup is a prototype. Versions are dated, not numbered. Each entry captures the user-visible or developer-visible shifts for that day — routine refactors and lint-only PRs aren't listed.

## 2026-04-19

**Collaboration surface**
- Added `?view=1` spectator mode: second humans can tail a live session read-only, with edits and chat streamed in via Supabase Realtime.
- "Copy read-only link" button in the session header.
- Agent teams are now a first-class surface: five named crews (Launch Review, Compliance Review, Design Crit, Architecture Review, Full Review) on the home page. Each prepends a shared mission context to every member's persona.

**A11y**
- `role="dialog"` + `aria-modal` + accessible names on CommandPalette, Settings, and TemplatePickerModal.
- `aria-hidden` on 16 decorative SVGs; explicit `aria-label` on icon-only buttons that were relying on the SVG for their name.
- `type="button"` added to 62 non-submit buttons across the app.
- Sidebar clear-search button and TaskChecklist expand toggle got proper labels and `aria-expanded`.

**Performance & polish**
- Root-level `ErrorBoundary` so crashes in auth/providers render a recovery UI instead of a blank screen.
- Inline pulse loader in `index.html` so users see motion immediately on cold load.
- `React.memo` on `ProgressBar` and `ReasoningChain`.

**Developer experience**
- `npm run typecheck` (fast tsc-only, no bundle).
- Node engine pinned to Vite 7's supported range (`^20.19.0 || >=22.12.0`); `.nvmrc` pinned to 22.12.0.
- `agent-teams.ts` module with `TEAM_PRESETS` + `resolveTeam()`.
- Supabase Realtime enabled (idempotently) on the `documents` table via migration 005.
- `supabase` env-var warning gated behind `import.meta.env.DEV` so it stops firing in production.
- Six debug `console.log` calls (orchestrator, agent, agent-actions, useOrchestrator) gated behind `DEV`.
- `App.tsx` debounce magic numbers extracted to named constants; "Saved"-status fade timer now tracked so concurrent saves don't race.

**Docs**
- `docs/brainstorms/2026-04-19-multi-entity-collab-design-lenses.md` — design, social, and engineering lenses on multi-human + multi-agent.
- `docs/brainstorms/2026-04-19-agent-teams.md` — what teams are for and where they're headed next.
- `CONTRIBUTING.md` — how to get set up and the PR conventions.

## Earlier

The repo history before 2026-04-19 is best read directly in `git log`. Highlights:
- The four-agent system (Aiden / Nova / Lex / Mira) and the orchestrator loop.
- Supabase persistence for sessions, documents, chat, and agent personas.
- Tiptap editor with agent-cursor decorations and a scroll minimap.
- The agent task board.
