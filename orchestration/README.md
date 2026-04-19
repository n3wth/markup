# Orchestration (restart protocol for future orchestrators)

You are a successor orchestrator. Your predecessor ran out of context. Read this first, then resume without losing continuity.

## What this is

An autonomous, long-running push to take markup from "polished agent demo" to a shipped product. Design: `docs/superpowers/specs/2026-04-19-markup-next-level-design.md`. Plan: `orchestration/plan.md`.

## Boot sequence (read these in order)

1. `docs/superpowers/specs/2026-04-19-markup-next-level-design.md` — thesis, quadrants, non-goals, success criteria. Do not re-litigate.
2. `orchestration/plan.md` — wave-by-wave task list.
3. `orchestration/state.md` — append-only log of every action taken. **Read the tail (last ~500 lines) to know what just happened.**
4. `orchestration/queue.json` — `pending | in_flight | in_review | merged | rejected` tasks. This is your worklist.
5. `orchestration/decisions.md` — mid-flight architectural calls your predecessors made. Respect them unless they block you.
6. `orchestration/runners.md` — available runners (Claude subagents, OpenClaw on Mini, ChatPRD, etc.) and their roles.
7. `orchestration/pr-protocol.md` — how to open, review, and merge PRs.

## Your loop

```
while queue.pending or queue.in_flight or queue.in_review:
    pick next task (respect dependencies, hot-file serialization)
    dispatch to appropriate runner
    monitor PR through CI + reviewer
    on approval + green CI: merge to main
    on rejection: send back to author with reviewer notes
    append every event to state.md
    if context_pressure > 70%: spawn successor and exit
```

## Hard rules

- **Never push to `main` directly.** Every change is a PR.
- **Never merge without:** (a) CI green, (b) reviewer agent approval, (c) no unresolved conflicts.
- **Author != reviewer.** Always use a different agent (different model or fresh context) for review.
- **No force-push, no skip hooks.**
- **Respect `decisions.md`.** If a predecessor made a call, don't reverse it without a new decision entry explaining why.
- **Oliver's veto is absolute.** If Oliver says stop, you stop.
- **Append to `state.md` before acting, not after.** If you crash mid-action, the log should still reflect intent.

## Halt conditions (stop the loop, alert Oliver)

- CI broken on `main` for 2+ consecutive merges
- Reviewer rejecting 2+ PRs in the same wave on same grounds
- A task retries > 3 times
- Dependency graph deadlocked
- Oliver messages "stop" / "halt" / "pause"

## Runners you can dispatch to

See `runners.md` for full roster. In brief:

- **Claude Agent tool** (in-process subagent) — fast, small tasks, research, review
- **`claude` CLI on Mini via SSH** — parallel long tasks, heavy builds
- **`openclaw` on Mini via SSH** — alternative Claude runner
- **ChatPRD** — wave-boundary PRD generation, landing copy
- **Codex / Cursor Agent / Copilot** — Wave-2 expansion (only after pipeline proven)

## Restart signal

When your context budget is running low:

1. Append `--- RESTART ---` entry to `state.md` with (a) current in-flight task ids, (b) any non-obvious in-progress reasoning, (c) any user instruction you received but haven't yet completed.
2. Tell Oliver a successor is being spawned.
3. End your turn cleanly (do not leave a tool call mid-flight).

The user will spawn you again. You start from step 1 of the boot sequence.
