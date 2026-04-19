# Orchestration state log (append-only)

Every orchestrator appends here. Never rewrite history. Format:

```
## <ISO timestamp> — <orchestrator id> — <event type>
<details>
```

Event types: `DISPATCH`, `PR_OPENED`, `PR_REVIEWED`, `PR_MERGED`, `PR_REJECTED`, `DECISION`, `ERROR`, `HALT`, `RESTART`.

---

## 2026-04-19T00:00Z — orch-1 — BOOT

First orchestrator online. Oliver granted autonomous authority for the markup next-level push. Spec approved at `docs/superpowers/specs/2026-04-19-markup-next-level-design.md`.

## 2026-04-19T00:01Z — orch-1 — RESEARCH

Dispatched Explore agent to map codebase. Findings:

- `orchestrator.ts` (691 lines, mixed concerns) is the hottest hot-file. Must be extracted before parallel wave-1 work.
- `App.tsx` has state-management creep. Extract into hooks before parallel UI tasks.
- No CI config exists (`.github/workflows/` missing). Wave 0 must add one — the whole orchestration plan depends on CI signaling green/red.
- Tests exist as pattern but very few test files. Rate limiter, phase machine, RLS boundaries are all untested.
- Supabase RLS present and session-owner-scoped.
- Gemini is single provider; no abstraction layer yet.

## 2026-04-19T00:02Z — orch-1 — DECISION

Granted scope per Oliver:
- Thesis: doc-first agent workspace, four quadrants A/B/C/D.
- 120-PR target across 4 waves.
- Runners wave-1: Claude subagents + OpenClaw on Mini. Wave-2: Codex/Cursor/Copilot.
- Reviewer: separate agent per PR, author ≠ reviewer.
- Merge authority: orchestrator, after CI + reviewer approval.
- ChatPRD used at wave boundaries for PRDs and at Wave 4 for landing copy. Not used for task-level specs.

## 2026-04-19T00:03Z — orch-1 — DRIFT DETECTED

Local `main` was 16 commits behind `origin/main` at boot. Pulled. New PRs include:
- #213 perf: memoize ProgressBar and ReasoningChain
- #212 feat: agent teams (named groups with shared mission)
- #209 feat: live-stream doc edits via Supabase Realtime
- #208 feat: copy-read-only-link button
- #206 feat: spectator mode (?view=1)
- #205 chore: pin Node version
- #204 feat: pulse loader pre-hydration
- #203 fix: ErrorBoundary around app root
- #202 chore: typecheck script

Impact on plan: part of Quadrant A (sharing, spectator mode, realtime) is already partially shipped. Plan must adjust to avoid duplicating work. See next DECISION entry when I finalize plan.md.

## 2026-04-19T00:04Z — orch-1 — RUNNER STATUS

- Mini SSH: ok (Darwin 25.5.0, arm64)
- Mini `claude` CLI: at `/Users/n3wth/.local/bin/claude`
- Mini `openclaw`: at `/opt/homebrew/bin/openclaw`
- Mini repo: cloned to `~/GitHub/markup`, deps installed (with non-fatal audit warnings)

## 2026-04-19T00:05Z — orch-1 — PROTOCOL

Writing `orchestration/pr-protocol.md`, `queue.json`, `plan.md` next. After that, Wave-0 dispatch.

## 2026-04-19T00:30Z — orch-1 — WAVE_0_ACTIVE

Dispatched parallel authors for W0-T001..T016 across Foundry team worktrees. All PRs open through GitHub: bootstrap (#218), T001 CI (#219), T015 PRD stubs (#221), T008 editor hook (#223), T004 rate limiter (#222), T011 RLS tests (#224), T012 agent-actions tests (#225), T013 wizard tests (#226), T002 turn queue (#227), T009 session state (#228), hotfix (#229), T014 provider seam (#230), T007 editor lock (#231), D-007 discipline (#232), T006 reaction router (#233), T005 phase dispatch thin (#234), T003 heartbeat (#235), T016 resume script (#236), T010 orchestrator wiring (#237), W3 handoff (#241).

## 2026-04-19T01:00Z — orch-1 — PRODUCTION_INCIDENT + HOTFIX

Prod crashed with `Cannot set properties of undefined (setting 'Activity')` in vendor-tambo chunk. Root cause: pre-existing circular chunk `vendor-tiptap <-> vendor-tambo` in `vite.config.ts` (not introduced by this push — surfaced by Vercel's build resolution). Hotfix PR #229 merged the two chunks into one `vendor-tiptap-tambo`. Prod green after deploy (dpl_34aBoxoP3JuySDMGFLVBcCBaYwFF).

## 2026-04-19T02:00Z — orch-1 — DECISION D-007 APPLIED

Audited plan against the four agent-native principles. Three reweightings: (1) new W0-T017 schema audit task, (2) promoted Wave 3 ahead of Wave 1-2 as the parity substrate, (3) parity gate added to reviewer rubric. PR #232 merged. Plan delta: ~20 paired MCP-tool PRs added; total now ~140 PRs planned.

## 2026-04-19T02:30Z — orch-1 — WAVE_3_HANDOFF_TO_CURSOR

Handed Wave 3 (Openness, ~18 PRs) to Cursor Agent. Brief at `orchestration/wave-3-cursor-brief.md`. PR #241. Cursor authors as `orch-cursor` in state.md. Rationale: native MCP support in Cursor IDE gives instant build-test feedback on MCP work.

## 2026-04-19T03:00Z — orch-1 — WAVE_0_SCORECARD

- **Merged (14):** bootstrap, hotfix, T001 CI, T002 turn-queue, T004 rate-limiter, T008 editor hook, T009 session state, T010 orchestrator wiring, T011 RLS tests, T012 agent-actions tests, T013 wizard tests, T014 provider seam, T015 PRD stubs, T016 resume script, D-007 discipline
- **Open, rebase agent operating on them:** #231 (T007 editor lock, APPROVE pending post-rebase re-verify), #233 (T006 reaction router, REQUEST_CHANGES — rebase needed), #234 (T005 phase dispatch, REQUEST_CHANGES — remove banner comments + decide on return), #235 (T003 heartbeat scheduler, not yet reviewed)
- **Pending author dispatch:** W0-T017 (schema audit, new from D-007)
- **External PRs on same branch pattern (not mine):** #240 keyboard shortcuts modal (Devin / claude-fork)

## 2026-04-19T03:15Z — orch-1 — RESTART_MARKER

Context budget thinning. Successor orchestrator: read this log top to bottom, then boot from `orchestration/README.md`. Work remaining when this restart was written:

**Immediate (Wave 0 closeout, ~5 PRs):**
- Wait for rebase agent's completion on #231 #233 #234 #235. When it reports back, re-dispatch reviewers on the rebased PRs; merge on approval + CI green.
- Dispatch W0-T017 (schema audit) — a single author, ~1 PR, no code deletion, produces `orchestration/agent-schema-migration.md`.
- Review + merge #241 (Wave 3 handoff brief to Cursor).

**Then (Wave 1 kickoff, in parallel with Cursor's Wave 3):**
- Dispatch six Wave 1 track leads per `orchestration/teams.md` (Project Scaffolding, Social Fabric, Portable Output, Time Machine, Findable, plus one for the track A2-A3 overlap).
- Each track lead starts with its first PR (e.g. Project Scaffolding → W1-T001 migration).
- **Parity gate:** every Wave 1 feature PR must pair with an MCP-tool PR. Parity tool-PRs can be delegated to Cursor (Wave 3 owner) as fast-follows — coordinate via PR cross-links.

**Halt conditions active:** none. CI green on main. Prod green.

**Runners active:** Claude Agent tool (in-process) + OpenClaw on Mini (underused so far — send Wave 1 long-running tasks there). Cursor Agent owns Wave 3. Codex + Copilot still on-deck for activation at ≥20 merged + <10% rejection (currently 14 merged, 1 reviewer-rejection on #222 fixed without major rework, 1 reviewer-rejection on #234 pending fix).

**Known coordination hazards for successor:**
- `src/orchestrator.ts` and `src/agent.ts` remain hot files despite Wave 0's extractions. Serialize merges touching them.
- When Wave 1 features touch `src/AgentConfigurator.tsx` (Wave 3 also touches it for the provider dropdown), coordinate via PR timing — one at a time.
- Cursor Agent (external) may push PRs with branch prefix `w3/` at any time. Review them through the same pool; merge authority is still yours.

**Oliver's active latitude:** merge authority held by orchestrator after reviewer-pool approval. Oliver can veto any PR; spot-checks at wave boundaries.

Successor: proceed. The fleet's pattern is proven. Keep it moving.
