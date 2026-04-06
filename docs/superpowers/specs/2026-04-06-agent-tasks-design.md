# Agent Task System

A shared task board that gives agents purpose and gives users visibility into what's being worked on. Tasks live in the chat stream as interactive cards, with a compact progress indicator in the editor header.

## Core Concept

Tasks are a contract between human and agents. Both sides can create, modify, and complete them. Tasks are anchored to document sections and drive agent behavior — instead of agents acting reactively, they work through a plan.

## Task Lifecycle

```
Created (pending) → Active (an agent is working on it) → Complete
                  ↘ Dismissed (user or agent removes it)
```

### How tasks get created

1. **From presets** — When a user picks a starter template (Product Brief, Tech Spec, etc.), the system generates a work plan with 4-7 tasks pre-assigned to active agents. The user sees this as an editable plan card before the session starts. They can reorder, remove, re-assign, or add tasks before hitting "Start writing."

2. **From user chat** — When a user says something that implies work ("we need a pricing section, @Nova handle that"), the system extracts a task card inline. The card shows the parsed task title, assigned agents, and Add/Edit/Ignore buttons. One click to confirm.

3. **From agent proposals** — Agents can propose new tasks when they spot gaps. An agent reading the doc might say "I think we need a separate task for GDPR compliance" and attach a Proposed Task card with Add to plan / Dismiss actions. Same approve/dismiss pattern as `propose_edit`.

4. **From user manually** — A simple "+ Add task" affordance in the chat input or task progress area.

### How tasks get completed

1. **Agent self-reports** — After finishing work on a section, the agent sends a message like "Done with technical constraints" and the system marks the task complete. A compact "Task 3 completed" banner appears in chat.

2. **User marks done** — User can check off a task manually from the task progress area or by clicking a completion action on the task card in chat.

3. **Auto-detection (v2)** — Future: infer completion from document content (e.g., section has 3+ paragraphs, task was "write X section").

### How tasks get dismissed

User clicks Dismiss on a proposed task, or removes a task from the plan. Agents cannot dismiss tasks — only propose removal with a rationale.

## Data Model

```typescript
interface AgentTask {
  id: string
  sessionId: string
  title: string                          // "Write technical constraints"
  status: 'pending' | 'active' | 'complete' | 'dismissed'
  assignedAgents: string[]               // ["Aiden", "Nova"]
  createdBy: 'user' | string             // 'user' or agent name
  sectionAnchor?: string                 // heading name this task maps to
  order: number                          // position in the plan
  completedBy?: string                   // who marked it done
  createdAt: string
  completedAt?: string
}
```

## Supabase Schema

```sql
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  title text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'complete', 'dismissed')),
  assigned_agents text[] not null default '{}',
  created_by text not null,
  section_anchor text,
  sort_order integer not null default 0,
  completed_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_agent_tasks_session on agent_tasks(session_id, sort_order);
```

RLS: same pattern as other tables — user owns via session.

## UI Components

### 1. Header Progress Indicator

Always visible in the editor toolbar, right side. Compact dot row:

```
[filled] [filled] [filled] [outlined] [outlined]  3/5
```

- Filled green dot = complete
- Outlined with agent color border = active (being worked on)
- Gray outlined = pending
- Clicking the dots opens/scrolls to task details in chat

### 2. Task Card (in chat stream)

Appears inline in chat messages. Three variants:

**Proposed task** (from agent):
```
PROPOSED TASK
Audit data privacy and GDPR compliance
Insert after task 5 · Assigned to: [Lex dot] Lex
[Add to plan]  [Dismiss]
```

**Extracted task** (from user message):
```
[circle] Write pricing strategy section
[Nova dot] [Mira dot] Nova + Mira
[Add task]  [Edit]  [Ignore]
```

**Completion banner**:
```
[green check] Task 3 completed  Draft technical requirements
```

### 3. Work Plan Card (session start)

Shown after picking a preset, before agents begin. Centered modal-like card:

```
Work Plan                    Auto-generated from template
─────────────────────────────────────────────────────────
1  ○  Define target audience           [Nova dot] Nova
2  ○  Write problem statement    [Aiden dot][Nova dot] Aiden + Nova
3  ○  Draft technical constraints      [Aiden dot] Aiden
4  ○  Map competitive landscape  [Nova dot][Lex dot] Nova + Lex
5  ○  Legal review                     [Lex dot] Lex
6  ○  Final review and polish                     All
─────────────────────────────────────────────────────────
+ Add task                          [Edit plan] [Start writing]
```

### 4. All Complete Summary

When last task finishes, a summary card appears in chat:

```
All tasks complete
7 sections written across 4 agents in 22 minutes. 1,420 words.

Aiden   3 tasks  ████████░░
Nova    4 tasks  ██████████
Lex     2 tasks  ████░░░░░░
Mira    2 tasks  ████░░░░░░

[Export]  [Add more tasks]
```

## Orchestrator Integration

### New action type: `task`

Add to `AgentActionType`:
```typescript
'task'  // agent proposes, completes, or comments on a task
```

`AgentAction` gains:
```typescript
taskAction?: {
  type: 'propose' | 'complete' | 'update'
  taskId?: string           // for complete/update
  title?: string            // for propose
  rationale?: string        // why this task is needed
  assignedAgents?: string[] // for propose
  sectionAnchor?: string    // for propose
}
```

### Task-aware prompting

`buildPrompt()` in `agent.ts` includes the current task list in the system prompt:

```
TASKS (current work plan):
1. [DONE] Define target audience (Nova)
2. [DONE] Write problem statement (Aiden, Nova)
3. [ACTIVE - you] Draft technical constraints (Aiden)
4. [pending] Map competitive landscape (Nova, Lex)
5. [pending] Legal review (Lex)

Your current task is #3. Focus on this. When done, say so and the orchestrator will advance.
```

### Turn selection

The orchestrator uses tasks to decide which agent goes next:
1. Find the first non-complete task in order
2. Pick an assigned agent that hasn't acted recently
3. Queue that agent with the task context as instruction

This replaces the current round-robin reaction system for task-driven sessions. Non-task sessions (no plan) keep the existing behavior.

## Session Store Changes

New functions in `session-store.ts`:

```typescript
saveAgentTasks(sessionId: string, tasks: AgentTask[]): Promise<void>
loadAgentTasks(sessionId: string): Promise<AgentTask[]>
updateAgentTask(taskId: string, patch: Partial<AgentTask>): Promise<void>
```

## Preset Task Templates

Each starter preset gets a default task list. Stored as static config, not in the database:

```typescript
const PRESET_TASKS: Record<string, Omit<AgentTask, 'id' | 'sessionId' | 'createdAt'>[]> = {
  'product-brief': [
    { title: 'Define target audience and user persona', assignedAgents: ['Nova'], order: 1, ... },
    { title: 'Write problem statement with pain points', assignedAgents: ['Aiden', 'Nova'], order: 2, ... },
    // ...
  ],
  'tech-spec': [ ... ],
  'design-review': [ ... ],
}
```

Agent assignment is resolved at runtime based on which agents are actually active in the session. If a preset assigns "Lex" but Lex isn't in the session, reassign to the closest match or leave unassigned.

## What This Does NOT Include (v1 scope)

- Task dependencies / blocking relationships
- Auto-completion detection from document content
- Drag-and-drop reordering
- Task time estimates or deadlines
- Sub-tasks
- Per-task discussion threads

These are all v2 candidates if the core loop works well.

## Design References

Paper artboards in "Bright wave" file:
- Layout A-D: Task panel placement options (chose "tasks in chat stream" over separate panel)
- Flow 1: Preset generates work plan
- Flow 2: Agent proposes task in chat
- Flow 3: User creates task via natural language
- Flow 4: All tasks complete with summary
