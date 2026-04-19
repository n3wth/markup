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
