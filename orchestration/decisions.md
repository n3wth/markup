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

## D-007 — 2026-04-19 — Agent-native discipline applied to Wave 1-3 planning

**Context:** Audited plan.md against the four agent-native principles (parity, granularity, composability, emergent capability). Multiple silent violations:

1. **Parity gap:** Wave 1 adds ~30 user-facing features (projects, sharing, export, history, search); zero of those pair an agent tool. Users could create a project in the UI but ask the agent and get "I don't have a tool for that."
2. **Granularity drift:** The current `AgentAction` schema includes workflow verbs (`task`, `plan`, `propose`, `rename`) that encode decisions the agent should make via prompt. Only `insert`, `replace`, `read`, `delete`, `chat`, `search` are primitives.
3. **Composability failure:** Features like "multi-turn tool use" (Wave 2) are scheduled as orchestrator code changes. With atomic tools, multi-turn is emergent — the agent just loops on primitives. Scheduling it as a code change reveals the current loop isn't agent-native.
4. **Emergent gap:** Agent can't read other docs in a project, list sessions, or reference sibling memory — those are planned as specific one-off tools in Wave 2 rather than available primitives.

**Decision:** Three reweightings of plan.md without changing the thesis:

1. **Parity gate on every Wave 1-2 feature PR.** UI PR and corresponding agent-tool PR ship together. ~20 extra paired PRs added, bringing plan total near 140. "Can an agent achieve this outcome?" becomes a merge blocker.

2. **Collapse workflow verbs in `AgentAction` into prompt patterns.** New Wave-0 task W0-T017: audit schema, deprecate `task`/`plan`/`propose`/`rename` as tool types, replace with prompt templates using the `insert`/`replace`/`chat` primitives.

3. **Promote Wave 3 (MCP server) ahead of Wave 1-2.** MCP is the natural parity-enforcement layer: every new agent tool is exposed through MCP, both in-app and external agents call the same surface. New order: Wave 0 → Wave 3 → Wave 1+2 (parallel, each feature ships as a tool) → Wave 4.

**Rationale:** Volume without agent-native discipline produces a better chat-sidebar app, not the doc-first agent workspace the spec commits to. The cost is ~15% more PRs and a one-wave reorder. The payoff is that every feature ships with parity from day one — the product agents can use is the same product humans can use.

**Implementation mechanics:**
- Update `orchestration/plan.md` to add W0-T017 and insert the reorder note at the top of Wave 1.
- Each Wave 1 task's description now includes "pairs with MCP tool W3-Txxx".
- Review rubric gains a seventh criterion: "Parity — if this adds a UI affordance, is there a corresponding agent tool?"
- Keep the thesis and 4-quadrant structure identical. This is discipline, not re-scoping.

**Supersedes:** refines D-002, D-004.
