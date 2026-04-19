# Decision log

Architectural calls the orchestrator made mid-flight. One entry per decision. Newer at bottom. Successors: respect these unless superseded.

---

## D-001 — 2026-04-19 — Reviewer must be a different agent from author

**Context:** Orchestrator is self-reviewing fleet output before merging.

**Decision:** Every PR gets reviewed by a fresh-context agent (different model where possible, different prompt always). Author ≠ reviewer, no exceptions.

**Rationale:** Self-review by the same model inherits the author's priors and approves bad code. Independent reviewer catches issues the author is blind to.

**Supersedes:** —

## D-002 — 2026-04-19 — Start with 2 runners, expand to 4

**Context:** Oliver has Codex, OpenClaw, Cursor Agent, Copilot available.

**Decision:** Wave-1 runners are Claude Agent (in-process) and OpenClaw on Mini only. Codex/Cursor/Copilot enter in Wave 2 once pipeline is proven stable (≥ 20 merged PRs with < 10% rejection rate).

**Rationale:** Debugging an orchestration layer across four heterogeneous runners simultaneously is a multiplicative failure mode. Get one pipeline clean, then replicate.

## D-003 — 2026-04-19 — CI is a hard merge gate

**Context:** No CI workflow existed at boot.

**Decision:** Wave 0, Task W0-add-ci, introduces `.github/workflows/ci.yml` that runs `npm run build && npm run lint && npm test`. Merge is blocked until this workflow passes on the PR branch. Reviewer may also block for other reasons.

**Rationale:** The entire orchestration depends on green/red signal being reliable. Without CI, the reviewer is guessing.

## D-004 — 2026-04-19 — Hot-file serialization

**Context:** `orchestrator.ts` and `App.tsx` are high-collision files per codebase research.

**Decision:** Only one in-flight PR at a time per hot file. Hot files list kept in `queue.json.hot_files`. Wave 0 extracts both files into smaller modules; afterward, serialization applies per-module, not per-monolith.

**Rationale:** Parallel PRs on the same 691-line file guarantee merge conflicts and test breakage.

## D-005 — 2026-04-19 — ChatPRD at wave boundaries, not per-task

**Context:** Oliver suggested ChatPRD.

**Decision:** Use ChatPRD at wave entry to generate the wave's PRD (user stories, acceptance criteria, success metrics), which becomes the reviewer's grading rubric. Also use ChatPRD in Wave 4 for landing/pricing copy. Do not use ChatPRD for per-task PR specs — overhead exceeds value.

**Rationale:** ChatPRD is strong at structured product writing; Claude is strong at code. Use each where it wins.

## D-006 — 2026-04-19 — Pre-existing wave-A features do not trigger replanning

**Context:** At boot, `main` already shipped spectator mode, realtime doc sync, copy-link, ErrorBoundary, and others — overlapping Quadrant A.

**Decision:** Accept these as wave-A progress. Plan.md's Quadrant A task list excludes already-shipped features. No tasks are regenerated to "redo" them; only tasks to extend or harden.

**Rationale:** Don't re-do work. Credit what's there and move on.
