# Agent Schema Migration — W0-T017

Audit of `AgentAction` (`src/agent-schema.ts`) against the four agent-native
principles from D-007. Deprecates workflow verbs that encode decisions the
agent should make via prompt. Maps each deprecated verb to a prompt template
over primitives.

No production code deletion in this task. Deprecation is marker-only; actual
removal lands in Wave 3 rewire.

## Principles (D-007)

1. **Parity** — every user outcome must be reachable by an agent tool.
2. **Granularity** — tools are primitives, not recipes. The agent composes.
3. **Composability** — multi-step behavior emerges from looping primitives,
   not from orchestrator-level verbs.
4. **Emergent capability** — new behaviors come from combining primitives,
   not from adding new verbs.

## Classification

Current schema enum:
`insert, replace, read, chat, search, rename, delete, propose, plan, ask, image`

| Verb       | Class     | Status    | Reason |
|------------|-----------|-----------|--------|
| `insert`   | primitive | keep      | Atomic doc mutation. |
| `replace`  | primitive | keep      | Atomic doc mutation. |
| `delete`   | primitive | keep      | Atomic doc mutation. |
| `read`     | primitive | keep      | Atomic doc observation. |
| `chat`     | primitive | keep      | Atomic comms channel. |
| `search`   | primitive | keep      | Atomic external observation. |
| `image`    | primitive | keep      | Atomic asset generation; not reducible to text. |
| `ask`      | primitive | keep      | Semantically a `chat` with expected reply; UI affordance differs enough to justify parity. Revisit in Wave 3. |
| `rename`   | workflow  | deprecate | Session-title mutation. Side-channel verb; not a doc primitive. |
| `propose`  | workflow  | deprecate | Pure `chat` with structured payload. Encodes a UX affordance that should be derived from message semantics. |
| `plan`     | workflow  | deprecate | Numbered-list `chat`. Formatting choice, not an action. Multi-step work should emerge from primitive loops. |
| `task`     | workflow  | remove    | **Not in schema enum** but referenced in `src/orchestrator.ts:296`. Stale — any `task` action fails Zod parsing today. |

## Migration map

Each deprecated verb maps to a prompt template over surviving primitives.

### `rename` → `chat` + session tool (post-Wave-3)

Today: `{ type: 'rename', newTitle: 'Mobile App PRD', chatMessage: '...' }`
sets session title via `onRenameSession` callback.

Prompt pattern replacement: when the doc's content no longer matches the
session title, emit a `chat` action suggesting the rename. User confirms in
product.

```json
{ "type": "chat", "chatMessage": "This doc is now about the mobile app — want me to rename the session to 'Mobile App PRD'?" }
```

Wave 3: expose `session.rename` as an MCP tool. Agents that need to rename
call the tool; UI still confirms.

### `propose` → `chat`

Today: `{ type: 'propose', proposalType: 'add-agent', proposal: '...', chatMessage: '...' }`
routes through `onProposal` to a custom UI affordance.

Prompt pattern replacement: proposals are `chat` messages phrased as
questions. The UI detects question intent and renders reply affordances.

```json
{ "type": "chat", "chatMessage": "Should we bring Lex in for the compliance section? I can send the invite if yes." }
```

`App.tsx` currently keys proposal UI off `action.type === 'propose'` — Wave 3
rewires this to parse chat intent.

### `plan` → `chat` (or loop of primitives)

Today: `{ type: 'plan', steps: [...], chatMessage: '...' }` renders a numbered
list.

Two cases.

**Case 1 — the plan is communication.** Agent wants the user to see the
approach before acting. This is a `chat`:

```json
{ "type": "chat", "chatMessage": "Plan: 1) fix intro, 2) add metrics, 3) tighten conclusion. Starting now." }
```

**Case 2 — the plan is execution.** Agent wants to do multiple things. This
is a loop of primitives across turns. No dispatch required — the
orchestrator's existing turn loop is the plan.

The `steps` field becomes a chat-message formatting convention, not a schema
field.

### `task` → remove

Not in schema enum. `src/orchestrator.ts:296` checks `action.type === 'task'`
and calls `config.onTaskAction`. Dead path — Zod parse fails before the check
runs. Wave 3 cleanup: delete the orchestrator branch and any `onTaskAction`
plumbing. No migration needed — users never saw this.

## Callers affected (Wave 3 rewire scope)

Inventory of production references to deprecated types. No changes here.

- `src/agent-schema.ts:4-7` — enum entries for `rename`, `propose`, `plan`.
- `src/orchestrator.ts:296` — stale `task` branch (remove).
- `src/orchestrator.ts:330` — `rename` branch calls `onRenameSession`.
- `src/orchestrator.ts:334` — `propose` branch calls `onProposal`.
- `src/agent-actions.ts:719-721` — `rename` chat emission.
- `src/agent-actions.ts:738-742` — `propose` chat emission.
- `src/agent-actions.ts:744-749` — `plan` numbered-list chat emission.
- `src/App.tsx:163` — `propose` branch for proposal UI.
- `src/components/TaskCard.tsx:63` — `plan` event rendering in timeline.
- `src/__tests__/agent-schema.test.ts:81-124` — schema tests for deprecated verbs.
- `src/__tests__/agent-actions.test.ts:243-244` — validation tests for `rename`, `propose`.

## Deprecation marker

Schema stays structurally unchanged in Wave 0. Deprecation is communicated
via source comment (follow-up PR, not this task):

```ts
// DEPRECATED (D-007, W0-T017): workflow verbs.
// 'rename' | 'propose' | 'plan' are deprecated in favor of prompt patterns
// over the 'chat' primitive. See orchestration/agent-schema-migration.md.
// Removal in Wave 3 rewire.
```

System prompt (agent.ts) writing rules gain:

> Prefer primitives. Use `chat` for anything that is fundamentally
> communication — including suggestions, numbered plans, and proposals. Only
> emit `rename`, `propose`, or `plan` if a primitive would be strictly less
> expressive (it never is).

Prompt-side guidance is the enforcement mechanism in the deprecation window;
the schema still accepts the old verbs so in-flight agents don't break.

## Acceptance check

- [x] Audited enum against four principles.
- [x] Marked `rename`, `propose`, `plan` deprecated (doc-level; code marker deferred).
- [x] Flagged stale `task` reference in orchestrator.
- [x] Mapped each deprecated verb to a prompt template over primitives.
- [x] Inventoried callers for Wave 3 rewire.
- [x] No production code deleted.
