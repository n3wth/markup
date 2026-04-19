# Markup: Next-Level Push — Design Spec

**Date:** 2026-04-19
**Owner:** Oliver (product) + autonomous orchestrator (execution)
**Status:** Approved for planning

## Thesis

Markup is the doc-first agent workspace. Three things must be simultaneously true at launch:

1. **It persists and shares real work.** Real projects, real multi-human collaboration, real export.
2. **The agents are materially smarter.** Cross-session memory, multi-step planning before acting, tool use beyond the editor, surfaced disagreement.
3. **It is open.** Any agent — from any provider, or the user's own — can join via an open protocol (MCP).

Launch is the forcing function that makes 1-3 converge. Without a launch date, scope creeps forever. Without 1-3 shipped, a launch yields a waitlist and no second visit.

## Non-Goals (out of scope this push)

- Mobile apps, native desktop, voice, video
- Teams/enterprise SSO, SOC2, billing plans beyond single-tier pricing
- Self-hosting, on-prem, air-gapped
- Non-doc surfaces (slides, spreadsheets, whiteboard)
- Model training or fine-tuning

If it isn't doc-centric and it doesn't serve waves 1-4 below, it doesn't ship in this push.

## Feature Quadrants

### Quadrant A — Foundation (Product Depth)

- **Project model:** docs grouped under projects; projects own personas, memory, settings
- **Sharing + permissions:** share link (view/comment/edit), invite by email, per-role RLS
- **Multiplayer:** real-time human-to-human presence + edit sync on the same doc, reusing the agent-cursor presence layer
- **Export:** Markdown, PDF, HTML, shareable snapshot URL
- **Version history:** per-doc snapshots, restore, diff viewer
- **Rename + organize:** project tree, archive, search across docs

### Quadrant B — Agent Depth

- **Persistent memory:** per-agent + per-project + per-user memory stores; retrieval at prompt-build time
- **Planning step:** agents produce a plan before acting on large tasks; plan is visible, editable by the human
- **Tool use beyond editor:** web search, URL fetch, retrieval over project docs, sandboxed code execution (Vercel Sandbox)
- **Inter-agent disagreement:** when two agents disagree, surface it as a UI affordance rather than burying it in chat
- **Multi-turn tool use:** agents call tools, read results, continue reasoning, act — instead of one-shot decide-and-edit
- **Per-agent API key:** BYO-key per persona; fall back to platform key

### Quadrant C — Openness

- **MCP server:** markup exposes doc read/write/comment tools so any MCP client (Claude Desktop, Cursor, Copilot, custom) can join the doc as an agent
- **Persona import/export:** personas as portable JSON; share link imports a persona
- **Provider abstraction:** unify Gemini, Claude, OpenAI behind a single agent interface; Gemini stays default
- **Public changelog + docs:** versioned, machine-readable changelog; dev-facing API docs

### Quadrant D — Launch

- **Landing page rewrite:** clear value prop, demo video, three-use-case copy
- **Onboarding:** 60-second first-doc flow with guided agent invite
- **Pricing page:** single paid tier + free tier with generous limits
- **Waitlist → first-100 ramp:** invite codes, email capture, first-100 onboard
- **Demo video:** 90-second scripted walkthrough
- **Public changelog:** live at markup.so/changelog
- **Analytics baseline:** PostHog events for doc create, agent invoke, share, export

## Orchestration Architecture

The orchestrator is a long-running autonomous agent that produces PRs, routes them through an independent reviewer, merges on approval, and restarts itself on context exhaustion.

### Components

- **Main orchestrator** (this Claude session, and its successors): reads state, picks the next task, dispatches to a runner, tracks PR through review and merge
- **Runners:** where the actual code gets written
  - Wave-1: in-process Claude subagents (Agent tool) + OpenClaw on Mac Mini via SSH
  - Wave-2 (after pipeline proven): Codex, Cursor Agent, Copilot
- **Reviewer:** a fresh agent (different model, different prompt, no context from authoring) that loads the PR diff + surrounding files and either approves or rejects with specific feedback. Author ≠ reviewer, always.
- **Merge authority:** the orchestrator merges after reviewer approval AND CI green AND no open conflicts
- **Human veto:** Oliver can stop any PR, task, or the orchestrator at any time

### State (durable, survives restarts)

All in `orchestration/`:

- `state.md` — append-only log of every action (task dispatched, PR opened, review result, merge, errors). New orchestrator reads this first.
- `queue.json` — `{ pending, in_flight, in_review, merged, rejected }` keyed by task id
- `decisions.md` — architectural calls made mid-flight with rationale
- `runners.md` — runner inventory, health, capacity
- `pr-protocol.md` — branch/commit/PR/review rules
- `plan.md` — the wave-by-wave task plan (written next, after this spec)
- `README.md` — restart protocol for future orchestrators

### Restart protocol

When this orchestrator's context fills:

1. Append a `RESTART_NEEDED` entry to `state.md` with current in-flight tasks
2. Spawn a successor orchestrator (fresh `claude` CLI session or Agent tool call)
3. Successor reads `orchestration/README.md` first, then `state.md`, then `queue.json`, then `plan.md`
4. Successor resumes: reclaims in-flight tasks (checks PR status), picks next pending, continues

### Safety gates

- **CI required:** `npm run build && npm run lint && npm test` must pass on the PR branch before merge
- **Reviewer authority:** reviewer can reject with specific reasons; rejection sends PR back to author agent with reviewer notes
- **Halt conditions:** auto-halt if (a) CI breaks on `main`, (b) two PRs in a row are reviewer-rejected on the same wave, (c) a task retries more than 3 times, (d) Oliver says stop
- **No force push, no skip hooks:** the orchestrator respects the repo's safety posture

### Collision avoidance

The codebase research (Task #4) flagged `orchestrator.ts` (691 lines, mixed concerns) and `App.tsx` as hot paths. Wave 0 extracts these into smaller modules so wave 1+ can parallelize without collisions.

- Only one in-flight PR per hot file at a time, enforced by the queue
- Task dependencies tracked in `queue.json`
- Shared migration/schema changes serialize behind a single owner
- UI tasks grouped by component ownership to keep component-level PRs independent

## Wave plan (detail in `orchestration/plan.md`)

- **Wave 0 — Foundation cleanup (~15 PRs):** extract orchestrator hot spots, introduce test scaffolding (vitest harness per subsystem), split App.tsx state, add CI workflow if missing, codify PR protocol
- **Wave 1 — Product depth, quadrant A (~35 PRs):** project model, sharing, multiplayer, export, version history
- **Wave 2 — Agent depth, quadrant B (~30 PRs):** memory stores, planning step, tool use, inter-agent disagreement surface
- **Wave 3 — Openness, quadrant C (~20 PRs):** MCP server, provider abstraction, persona import/export, changelog
- **Wave 4 — Launch, quadrant D (~20 PRs):** landing rewrite, onboarding, pricing page, demo video, waitlist, analytics

Total: ~120 PRs. Waves 1-3 run partially in parallel after wave 0 stabilizes. Wave 4 is mostly serial.

## Success criteria

- All four quadrants shipped end-to-end, usable by a first external user without hand-holding
- `main` is always deployable; no more than 4 consecutive hours of broken CI
- No rollback of a merged PR without an accompanying post-mortem in `orchestration/decisions.md`
- Launch-ready: domain live, pricing live, demo video live, waitlist open
- Oliver can onboard first external user in under 5 minutes from first click

## Risks and mitigations

- **Risk:** agent-written code is plausible but wrong. **Mitigation:** reviewer agent, CI gate, Oliver veto.
- **Risk:** orchestrator restart loses in-flight PR context. **Mitigation:** every PR's spec and progress is reconstructible from `state.md` + PR body + branch name.
- **Risk:** too many PRs to review cognitively. **Mitigation:** reviewer is a separate agent, not Oliver. Oliver spot-checks at wave boundaries.
- **Risk:** schema or API breaking changes cascade across tasks. **Mitigation:** schema changes serialize behind a single owner per migration.
- **Risk:** Gemini rate limits during agent-heavy development. **Mitigation:** runners use Claude for code work, Gemini only for in-app agents. Separate quotas.

## Explicit latitude granted

Oliver granted the orchestrator:
- Merge authority (after reviewer approval + CI)
- Thesis/quadrant selection (this spec)
- Runner selection (subagents + Mini wave 1, expand later)
- Wave decomposition and task generation
- Feature trade-offs within a quadrant

Oliver retains:
- Veto on any PR, task, or direction change
- Final call on launch date
- Thesis change (would require a new spec)
