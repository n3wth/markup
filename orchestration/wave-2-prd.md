# Wave 2 PRD — Agent depth (Quadrant B)

> This is a stub. Full PRD to be generated via ChatPRD MCP at wave-entry time and pasted here.

## Wave goal

Agents become materially smarter. Memory, planning, tools, surfaced disagreement.

## Tasks in scope

### Track B1: Persistent memory (~7 PRs)

- **W2-T001** Migration: `agent_memories` (agent_id, project_id, kind, content, embedding, created_at)
- **W2-T002** Memory write: end-of-session agent extracts "what I learned about this project" to memory
- **W2-T003** Memory retrieval at prompt-build time: kNN over embedding, top-k injected
- **W2-T004** Per-user memory (cross-project): "preferences" memory kind
- **W2-T005** Memory UI: view/edit/delete per-agent memories
- **W2-T006** Forget command in chat ("forget X")
- **W2-T007** Embedding provider (Gemini embedding endpoint) + cost-guard

### Track B2: Planning step (~5 PRs)

- **W2-T008** Plan schema: `AgentPlan = { steps: [{ id, action, rationale }] }`
- **W2-T009** `askAgentForPlan()` entrypoint before multi-step tasks
- **W2-T010** Plan UI: card in timeline showing plan steps, edit before approve
- **W2-T011** Approve plan → execute step-by-step; human can interject per step
- **W2-T012** Plan replay: re-run an approved plan in a new doc

### Track B3: Tool use beyond editor (~8 PRs)

- **W2-T013** Tool protocol: `AgentTool = { name, description, schema, invoke }`; register tools per session
- **W2-T014** Web search tool (Exa, via MCP if available, else HTTP)
- **W2-T015** URL fetch tool (fetch and summarize a URL)
- **W2-T016** Project retrieval tool (search other docs in same project)
- **W2-T017** Code execution tool via Vercel Sandbox
- **W2-T018** Tool result rendering in chat + insertable into doc
- **W2-T019** Tool permission prompt: user approves first use per tool per session
- **W2-T020** Tool usage telemetry

### Track B4: Inter-agent disagreement (~4 PRs)

- **W2-T021** Disagreement detection: when agents' next actions conflict or contradict
- **W2-T022** Disagreement card UI: both positions visible, human picks
- **W2-T023** Record resolution as memory for each agent
- **W2-T024** Timeline entry for disagreements

### Track B5: Multi-turn tool use (~4 PRs)

- **W2-T025** Agent loop: propose tool → get result → reason → next action (up to N turns)
- **W2-T026** Budget: tokens + tool-calls per task, enforced
- **W2-T027** Early-exit: agent can hand back control if stuck
- **W2-T028** Per-agent BYO-key: persona can carry its own API key, fall back to platform

## User stories

_To be populated by ChatPRD._

## Acceptance criteria per task

_To be populated by ChatPRD. One block per task ID above._

## Success metrics

_To be populated by ChatPRD._

## Open questions

_To be populated by ChatPRD._
