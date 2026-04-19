# Implementation plan — markup next-level push

**Spec:** `docs/superpowers/specs/2026-04-19-markup-next-level-design.md`
**Owner:** autonomous orchestrator; Oliver holds veto
**Target:** ~120 PRs across 4 waves

## Wave 0 — Foundation cleanup (~16 PRs)

Goal: de-risk parallel authoring by eliminating the hot-file monolith, add CI, harden test scaffolding. Nothing ships product value here; this wave unlocks safe parallelism for Waves 1-3.

Serialize Wave 0. One PR at a time per hot file. Target completion: ~3 days.

### W0-T001 — Add CI workflow
Add `.github/workflows/ci.yml` running `npm ci`, `npm run lint`, `npm run build` (which includes `tsc -b`), `npm test`. Triggers on PR + push to main. Caches npm. Author: Claude subagent. Reviewer: openclaw/Mini. **Blocking for all subsequent merges.**

### W0-T002 — Extract turn queue from `orchestrator.ts`
Move queue state (pending/processing/turnCount/exchangeCount) into `src/orchestrator/turn-queue.ts`. Orchestrator imports and composes. Add queue-focused tests.

### W0-T003 — Extract heartbeat scheduler
Move `scheduleHeartbeat()` + timer tracking into `src/orchestrator/heartbeat-scheduler.ts`.

### W0-T004 — Extract rate limiter from `agent.ts`
Move the rate-limiter state machine (`waitForSlot`, backoff, cooldown) into `src/agent/rate-limiter.ts`. Inject into `askAgent`.

### W0-T005 — Extract phase dispatch from orchestrator
Thin the phase-change path: orchestrator calls into `phase-machine` cleanly. No behavior change, reduces orchestrator to pure coordination.

### W0-T006 — Extract reaction round-robin
Round-robin routing into `src/orchestrator/reaction-router.ts`. Tested with synthetic agents.

### W0-T007 — Extract editor lock coordinator
Pull `editorLockRef` read + wait + apply flow into `src/orchestrator/editor-lock.ts`.

### W0-T008 — Split App.tsx: extract editor wiring hook
`useMarkupEditor()` owns Tiptap instance, extensions, save debounce. App.tsx consumes.

### W0-T009 — Split App.tsx: extract session state hook
`useSessionState()` owns activeSession, messages, tasks, agentStates.

### W0-T010 — Split App.tsx: extract orchestrator wiring hook
`useOrchestratorWiring()` subscribes message + task callbacks to orchestrator.

### W0-T011 — Add RLS boundary integration tests
Test that cross-user doc/session access is rejected. Uses two test users in local Supabase or mocked supabase client.

### W0-T012 — Add agent-actions transaction tests
Test insert/replace/delete transactions produce expected Tiptap state. Blocks accidental regressions in Waves 1-2.

### W0-T013 — Add wizard-of-oz rule-firing tests
Cover observation detection, duplicate suppression, priority ordering.

### W0-T014 — Provider abstraction (minimal)
Define `AgentProvider` interface in `src/agent/provider.ts` with `complete()` and `streamComplete()`. Adapter for Gemini. **No new providers yet** — this is a seam so Wave 2/3 can add Claude + OpenAI without refactoring `askAgent`.

### W0-T015 — Wave PRD infrastructure
Create `orchestration/wave-1-prd.md`, `wave-2-prd.md`, `wave-3-prd.md`, `wave-4-prd.md` (stubs). Run ChatPRD against each wave spec at wave-entry time.

### W0-T016 — Orchestrator resume test
A dry-run: orchestrator writes state.md + queue.json, a successor reads them, resumes a mock task. No product code changed; validates restart protocol works.

### W0-T017 — Agent-native schema audit
Audit `AgentAction` in `src/agent-schema.ts` against the four agent-native principles. Mark workflow verbs (`task`, `plan`, `propose`, `rename`) deprecated — those encode decisions the agent should make via prompt, not dispatch. Keep primitives (`insert`, `replace`, `delete`, `read`, `chat`, `search`). Produce `orchestration/agent-schema-migration.md` mapping deprecated verbs to prompt templates over primitives. No production code deletion yet — that's Wave 3 rewire. Added per D-007.

---

## Wave reorder (per D-007, agent-native discipline)

**New order:** Wave 0 → Wave 3 (MCP foundation) → Wave 1 + Wave 2 (parallel, each feature ships with a matching MCP tool) → Wave 4.

**Why:** MCP is the parity-enforcement layer. Every Wave 1-2 feature ships with an agent-callable tool from day one. In-app agent and external agents (Claude Desktop, Cursor, Copilot) consume the same tool surface — no drift.

**Parity gate:** Every Wave 1-2 PR that adds a UI affordance ships paired with an MCP-tool PR for the same capability. Reviewer's seventh rubric criterion: "Parity — does an agent have a tool for the outcome this UI enables?" Exceptions: user-only actions (biometric, camera, OAuth consent, keyboard shortcuts).

## Wave 1 — Product depth, Quadrant A (~34 PRs + ~20 paired MCP tool PRs)

Goal: markup is usable for real work. Projects, sharing, export, history, organization. **Every feature ships with a matching agent tool.**

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

---

## Wave 2 — Agent depth, Quadrant B (~28 PRs)

Goal: agents become materially smarter. Memory, planning, tools, surfaced disagreement.

### Track B1: Persistent memory (~7 PRs)

- **W2-T001** Migration: `agent_memories` (agent_id, project_id, kind, content, embedding, created_at)
- **W2-T002** Memory write: end-of-session agent extracts "what I learned about this project" to memory
- **W2-T003** Memory retrieval at prompt-build time: kNN over embedding, top-k injected
- **W2-T004** Per-user memory (cross-project): "preferences" memory kind
- **W2-T005** Memory UI: view/edit/delete per-agent memories
- **W2-T006** Forget command in chat ("forget X")
- **W2-T007** Embedding provider (Gemini embedding endpoint) + cost-guard

### Track B2: Planning step (~5 PRs)

- **W2-T008** Plan schema: `AgentPlan = { steps: [{ id, action, rationale }] }`
- **W2-T009** `askAgentForPlan()` entrypoint before multi-step tasks
- **W2-T010** Plan UI: card in timeline showing plan steps, edit before approve
- **W2-T011** Approve plan → execute step-by-step; human can interject per step
- **W2-T012** Plan replay: re-run an approved plan in a new doc

### Track B3: Tool use beyond editor (~8 PRs)

- **W2-T013** Tool protocol: `AgentTool = { name, description, schema, invoke }`; register tools per session
- **W2-T014** Web search tool (Exa, via MCP if available, else HTTP)
- **W2-T015** URL fetch tool (fetch and summarize a URL)
- **W2-T016** Project retrieval tool (search other docs in same project)
- **W2-T017** Code execution tool via Vercel Sandbox
- **W2-T018** Tool result rendering in chat + insertable into doc
- **W2-T019** Tool permission prompt: user approves first use per tool per session
- **W2-T020** Tool usage telemetry

### Track B4: Inter-agent disagreement (~4 PRs)

- **W2-T021** Disagreement detection: when agents' next actions conflict or contradict
- **W2-T022** Disagreement card UI: both positions visible, human picks
- **W2-T023** Record resolution as memory for each agent
- **W2-T024** Timeline entry for disagreements

### Track B5: Multi-turn tool use (~4 PRs)

- **W2-T025** Agent loop: propose tool → get result → reason → next action (up to N turns)
- **W2-T026** Budget: tokens + tool-calls per task, enforced
- **W2-T027** Early-exit: agent can hand back control if stuck
- **W2-T028** Per-agent BYO-key: persona can carry its own API key, fall back to platform

---

## Wave 3 — Openness, Quadrant C (~18 PRs)

Goal: any agent can join via open protocol. Persona portability. Provider abstraction lands.

### Track C1: MCP server (~8 PRs)

- **W3-T001** MCP server scaffold at `api/mcp/[...route].ts` (Vercel function)
- **W3-T002** Authentication: per-user MCP token (issue/revoke in settings)
- **W3-T003** Tool: `doc.read` — returns current doc content (Markdown)
- **W3-T004** Tool: `doc.edit` — apply a Tiptap-compatible edit
- **W3-T005** Tool: `doc.comment` — add a comment
- **W3-T006** Tool: `session.list` — list user's sessions in a project
- **W3-T007** External-agent presence: show MCP-joined agents in cursor layer with distinct avatar
- **W3-T008** MCP rate limiting per token

### Track C2: Persona portability (~5 PRs)

- **W3-T009** Persona JSON schema (avatar, color, system prompt, tools, memory-scope)
- **W3-T010** Export persona from AgentConfigurator
- **W3-T011** Import persona via URL or paste
- **W3-T012** Public-share persona link
- **W3-T013** Persona marketplace page (static list of shared personas, read-only)

### Track C3: Provider abstraction full landing (~3 PRs)

- **W3-T014** Claude provider adapter
- **W3-T015** OpenAI provider adapter
- **W3-T016** Per-persona provider selector in AgentConfigurator

### Track C4: Developer surface (~2 PRs)

- **W3-T017** Public changelog page at `/changelog` (markdown source, static)
- **W3-T018** Dev docs page at `/docs` (MCP tools, persona format, API key usage)

---

## Wave 4 — Launch, Quadrant D (~16 PRs)

Goal: shipped product. Landing, onboarding, pricing, analytics, waitlist.

Mostly serial; coordinate with ChatPRD for copy.

### Track D1: Landing + marketing (~5 PRs)

- **W4-T001** Landing hero rewrite (new value prop, demo video embed)
- **W4-T002** Three-use-case section (drafting specs, collaborative brainstorm, agent-assisted review)
- **W4-T003** Agent showcase (live demo embedded, not just screenshot)
- **W4-T004** Social proof / design polish pass
- **W4-T005** Demo video production (90s, scripted, produced externally; this PR embeds)

### Track D2: Onboarding (~4 PRs)

- **W4-T006** First-run flow: guided first doc with default agent speaking first
- **W4-T007** Invite-agent nudge (if user hasn't added an agent after 60s)
- **W4-T008** Sample project preloaded with a short demo doc
- **W4-T009** Onboarding completion analytics event

### Track D3: Pricing + waitlist (~4 PRs)

- **W4-T010** Pricing page (free + paid tier, simple)
- **W4-T011** Paid tier gating (usage caps enforced server-side)
- **W4-T012** Waitlist signup (email capture) with invite-code gate
- **W4-T013** First-100 ramp admin panel (approve waitlist entries)

### Track D4: Analytics + observability (~3 PRs)

- **W4-T014** PostHog event map: doc_create, agent_invoke, agent_reply, share, export, signup, first_doc_complete
- **W4-T015** Langfuse trace enrichment: per-task labels
- **W4-T016** Health dashboard (admin-only): daily actives, agent errors, rate-limit hits

---

## Dependencies + critical path

```
W0-T001 (CI) ──┬─ blocks merging of everything after
               │
W0-T002..T010 (hot-file extractions) ── unblock parallel Wave 1 tracks
               │
W0-T014 (provider seam) ── unblocks W3-T014/T015 later
               │
Wave 1 tracks A1-A6 parallelizable once W0 done
Wave 2 starts after Wave 1 is ~50% merged (agents need the project model)
Wave 3 starts after W0-T014 lands and Wave 1 ~80%
Wave 4 starts when Waves 1-3 are feature-complete (can overlap T014-T016 earlier)
```

## Non-duplicates (features already shipped at boot)

These were merged before the orchestrator started — do not re-create:

- Spectator mode (`?view=1`) — PR #206
- Copy-read-only-link button — PR #208
- Live-stream doc edits via Realtime — PR #209
- Agent teams (named groups) — PR #212
- ErrorBoundary at app root — PR #203
- Node version pinned — PR #205
- Pre-hydration pulse loader — PR #204

Adjacent tasks in this plan *extend* these (e.g., W1-T016 extends #209 to broadcast human edits too). They do not redo them.

## Stop-the-world triggers

- Wave 0 incomplete after 5 days → halt, reassess
- Wave 1 rejection rate > 20% → halt, retighten reviewer rubric
- CI broken on main for > 4 hours → halt, Oliver alerted
- Budget: if Gemini/Claude API spend exceeds pre-agreed ceiling in a 24h window → halt
