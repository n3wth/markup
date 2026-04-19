# Wave 3 Handoff — Cursor Agent

**Owner:** Cursor Agent (operated by Oliver inside the Cursor IDE)
**Scope:** Wave 3 — Quadrant C (Openness). ~18 PRs. Task IDs W3-T001 through W3-T018.
**Spec:** `docs/superpowers/specs/2026-04-19-markup-next-level-design.md`
**Plan:** `orchestration/plan.md` (Wave 3 section is authoritative)
**Protocol:** `orchestration/pr-protocol.md` — every rule applies
**Decisions:** `orchestration/decisions.md` — read D-001 through D-007 before starting

## Why you (Cursor) own this wave

Wave 3 is the MCP server + persona portability + provider abstraction + dev docs. You have native MCP support in the IDE, so you get instant feedback on tools you author (does it surface in your own tool list? can you call it?). That tight loop matters here more than anywhere else in the plan.

Wave 3 was reordered ahead of Wave 1/2 per D-007 — it's the parity-enforcement layer. Every feature in Waves 1 and 2 will ship with a paired MCP tool. Which means this wave's quality directly determines Wave 1+2 throughput. Do it right.

## What you're building

### Track C1 — MCP server (W3-T001..T008, 8 PRs)

The markup MCP server lives at `api/mcp/[...route].ts` (new Vercel function). It exposes markup's doc/session model to any MCP client (Claude Desktop, Cursor, Copilot, custom).

- **W3-T001** — scaffold `api/mcp/[...route].ts`. Accept POST. Route MCP protocol messages. Stub all tool handlers with `{error: 'not implemented'}`. Deploy, confirm Cursor can see the server when pointed at the Vercel preview URL.
- **W3-T002** — auth. Per-user MCP token issuance in markup settings UI. Token lookup in the MCP handler. Reject unauthed requests with 401.
- **W3-T003** — tool: `doc.read(session_id)`. Returns current doc as Markdown.
- **W3-T004** — tool: `doc.edit(session_id, op)`. Accepts a Tiptap-compatible edit op. Writes through the same code path as the in-app agent.
- **W3-T005** — tool: `doc.comment(session_id, content, anchor?)`. Adds a comment (reuse existing comment primitive).
- **W3-T006** — tool: `session.list(project_id?)`. Lists user's sessions.
- **W3-T007** — external-agent presence. When an MCP client is actively connected, render a cursor in the doc with a distinct avatar (different from the 4 built-in personas). Reuse `agent-cursor.ts` decoration layer.
- **W3-T008** — rate limiting per token (reuse `src/agent/rate-limiter.ts` pattern).

### Track C2 — Persona portability (W3-T009..T013, 5 PRs)

- **W3-T009** — persona JSON schema (`avatar`, `color`, `systemPrompt`, `tools[]`, `memoryScope`).
- **W3-T010** — export from AgentConfigurator: downloads a `.markup-persona.json`.
- **W3-T011** — import via URL or paste.
- **W3-T012** — public-share link for a persona (`markup.so/p/<token>`).
- **W3-T013** — persona marketplace page at `/personas` (static list of publicly-shared personas, read-only).

### Track C3 — Provider abstraction full landing (W3-T014..T016, 3 PRs)

The seam landed in W0-T014 (`src/agent/provider.ts` + `src/agent/providers/gemini-provider.ts`). You wire the second and third adapters:

- **W3-T014** — `src/agent/providers/claude-provider.ts`. Use Anthropic SDK or Vercel AI Gateway.
- **W3-T015** — `src/agent/providers/openai-provider.ts`. Use OpenAI SDK or Vercel AI Gateway.
- **W3-T016** — AgentConfigurator: per-persona provider dropdown + BYO-key input.

### Track C4 — Developer surface (W3-T017..T018, 2 PRs)

- **W3-T017** — public changelog at `/changelog`. Markdown-sourced, versioned.
- **W3-T018** — dev docs at `/docs`. MCP tools reference, persona format, API key usage.

## Teams you own

Per `orchestration/teams.md`:
- **Open Port** (Socket, Pipe, Bridge) — Track C1
- **Persona Vault** (Keeper, Courier) — Track C2
- **Polyglot** (Envoy, Emissary) — Track C3
- **Docwright** (Quill) — Track C4

You can choose: run these as named personas in your prompts, or just author-attribute in PR bodies. Either works. The teams.md roster is for human readability, not enforced.

## The rules (non-negotiable)

1. **Branch prefix `w3/`.** Pattern: `w3/W3-T<001-018>-<slug>`. Example: `w3/W3-T001-mcp-scaffold`.
2. **One task per PR.** If you find a second issue, file a follow-up task in `orchestration/queue.json` and open a new branch.
3. **CI must pass before you request review.** `.github/workflows/ci.yml` runs `npm ci && npm run lint && npm run typecheck && npm test && npm run build`. If it's red, don't ping for review.
4. **Author ≠ reviewer.** Every PR needs a reviewer from outside Cursor. Ping me (the orchestrator) when a PR is ready; I'll dispatch an independent reviewer agent (different model, fresh context) from the Review Pool (`teams.md` — Opal / Onyx / Quartz / Jasper / Slate / Flint).
5. **Parity gate applies.** Every UI-affordance you ship needs a paired MCP tool. The wave 3 spec already bakes this in — the MCP tools ARE the features — but W3-T010 (export persona UI) needs a matching `persona.export(name)` tool, etc. Reviewer will block on missing parity.
6. **No force-push, no skip hooks.** Standard.
7. **Respect decisions.** D-001 through D-007 are binding. If you disagree with a decision, open a new decision entry arguing for supersession — don't silently work around it.

## Coordination with my in-process fleet

I'm simultaneously running Wave 1 (product depth) in Claude subagents + OpenClaw on Mini. Wave 1 features rely on your MCP tools for parity. That means:

- **Your Track C1 (MCP scaffold + tools) is the gate for Wave 1's parity compliance.** The sooner W3-T001..T008 merge, the sooner I can ship Wave 1 tracks.
- **You don't block on me.** You can work through Wave 3 in task-ID order without waiting for anything from Wave 1.
- **Shared files to watch out for:** `src/agent/provider.ts` (you extend, I extend — coordinate via PR), `src/AgentConfigurator.tsx` (you add provider dropdown, I add other configurators — one-at-a-time per D-004 hot-file rule).

## How you report status

Append to `orchestration/state.md` at these milestones:
- Start of wave: `## <ISO> — orch-cursor — WAVE_3_START`
- Each PR merged: `## <ISO> — orch-cursor — PR_MERGED W3-T<id> — <pr-url>`
- Blocked: `## <ISO> — orch-cursor — BLOCKED W3-T<id> — <reason>`
- Wave complete: `## <ISO> — orch-cursor — WAVE_3_COMPLETE — <N merged> / <M rejected>`

Use `orch-cursor` as your orchestrator id so future-me can grep for your entries separately from `orch-1` (my entries).

## First actions (do these in this order)

1. Read the spec + plan + pr-protocol + decisions. Sit with them. Don't start coding until you've internalized the four principles (parity, granularity, composability, emergent capability) from D-007.
2. Spike W3-T001 (MCP scaffold). Get a stub `/api/mcp` deployed to a Vercel preview, point your own Cursor at it, confirm the handshake. This is the smallest useful thing.
3. Open PR #W3-T001. Ping me for review.
4. After #W3-T001 merges: work through W3-T002..W3-T008 at your own pace. Parallel tracks C2/C3/C4 can start any time after C1 is scaffolded.

## Escalation

- Production break: tag @oliver in the PR, halt the wave.
- Spec ambiguity: file a question in the PR description, ping me. I'll ruling or escalate to Oliver.
- Merge conflict you can't resolve: don't force-push; rebase, resolve, push. If you can't resolve, close the PR and open a fresh one from current main.

## Runway

You have ~18 PRs of work. At one PR per 20-45 minutes (typical agent-task pace), that's a ~10-15 hour wave. You can absolutely split it across sessions; `orchestration/state.md` is how you hand off to future-you.

Good luck. Ship the MCP.
