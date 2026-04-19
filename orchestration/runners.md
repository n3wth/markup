# Runner roster

Inventory of places the orchestrator can dispatch work. Health checked at each orchestrator boot.

## Wave-1 runners (active)

### R-1: Claude Agent tool (in-process subagent)

- **Invocation:** `Agent` tool with `subagent_type` matching task (Explore, general-purpose, code-reviewer, etc.)
- **Best for:** fast small tasks, research, in-context review, file audits, PR comment resolution
- **Capacity:** many in parallel per orchestrator turn
- **Cost:** counts against orchestrator's context budget
- **Health:** always available

### R-2: `claude` CLI on Mac Mini via SSH

- **Path:** `ssh mini 'cd ~/GitHub/markup && claude -p "..."'`
- **Best for:** long-running implementation tasks, isolated work that shouldn't touch orchestrator context
- **Capacity:** 1-2 parallel sessions; heavy tasks serialize
- **Health verified 2026-04-19:** Mini SSH ok, claude at `/Users/n3wth/.local/bin/claude`, repo cloned, deps installed
- **Worktree pattern:** use `.worktrees/<task-id>` on Mini to isolate tasks on their own branches

### R-3: `openclaw` on Mac Mini via SSH

- **Path:** `ssh mini 'cd ~/GitHub/markup && openclaw "..."'`
- **Best for:** alternate Claude runner for review (provides author/reviewer separation when both would otherwise be Claude)
- **Capacity:** 1 parallel session
- **Health verified 2026-04-19:** `/opt/homebrew/bin/openclaw`

### R-4: ChatPRD MCP (wave-boundary only)

- **Registration:** `claude mcp add --transport http ChatPRD https://app.chatprd.ai/mcp` (registered 2026-04-19; tools surface after next session start)
- **Invocation:** MCP tools (names TBD once surfaced); orchestrator calls at wave boundary to produce the wave PRD, writes output to `orchestration/wave-N-prd.md`
- **Best for:** structured PRDs at wave boundaries, Wave-4 landing/pricing/onboarding copy, reviewer rubric generation
- **Not for:** task-level specs, code review, daily orchestration
- **Fallback if MCP unreachable:** Claude generates the PRD using the wave spec as input; noted in state.md

## Wave-2 runners (on deck, activate after 20 clean merges)

### R-5: Codex

- **Status:** on deck
- **Activation criteria:** Wave-1 pipeline clean (≥ 20 merged, < 10% rejection)

### R-6: Cursor Agent

- **Status:** on deck
- **Activation criteria:** same

### R-7: Copilot

- **Status:** on deck
- **Activation criteria:** same

## Review pairings (author / reviewer)

Must be different entity or different model. Preferred pairings:

| Author (R) | Reviewer (R) |
|---|---|
| R-1 Claude Agent | R-3 openclaw (Mini) |
| R-2 claude (Mini) | R-1 Claude Agent (separate subagent, fresh context) |
| R-5 Codex | R-1 Claude Agent |
| R-6 Cursor Agent | R-1 Claude Agent |

When two Claude-family agents are paired, enforce fresh context (new Agent tool invocation, not SendMessage resume).

## Dispatch patterns

```
# Small task, fast turnaround — use in-process Agent
Agent(subagent_type="general-purpose", prompt="<task + PR-protocol reference>")

# Long task, keep orchestrator context clean — use Mini
Bash("ssh mini 'cd ~/GitHub/markup && git worktree add .worktrees/W1-T042 origin/main && cd .worktrees/W1-T042 && claude -p \"<task>\"'")

# Reviewer — different agent, loads PR diff
Agent(subagent_type="compound-engineering:review:kieran-typescript-reviewer", prompt="Review PR #N for <criteria>")
```
