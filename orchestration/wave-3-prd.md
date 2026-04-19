# Wave 3 PRD — Openness (Quadrant C)

> This is a stub. Full PRD to be generated via ChatPRD MCP at wave-entry time and pasted here.

## Wave goal

Any agent can join via open protocol. Persona portability. Provider abstraction lands.

## Tasks in scope

### Track C1: MCP server (~8 PRs)

- **W3-T001** MCP server scaffold at `api/mcp/[...route].ts` (Vercel function)
- **W3-T002** Authentication: per-user MCP token (issue/revoke in settings)
- **W3-T003** Tool: `doc.read` — returns current doc content (Markdown)
- **W3-T004** Tool: `doc.edit` — apply a Tiptap-compatible edit
- **W3-T005** Tool: `doc.comment` — add a comment
- **W3-T006** Tool: `session.list` — list user's sessions in a project
- **W3-T007** External-agent presence: show MCP-joined agents in cursor layer with distinct avatar
- **W3-T008** MCP rate limiting per token

### Track C2: Persona portability (~5 PRs)

- **W3-T009** Persona JSON schema (avatar, color, system prompt, tools, memory-scope)
- **W3-T010** Export persona from AgentConfigurator
- **W3-T011** Import persona via URL or paste
- **W3-T012** Public-share persona link
- **W3-T013** Persona marketplace page (static list of shared personas, read-only)

### Track C3: Provider abstraction full landing (~3 PRs)

- **W3-T014** Claude provider adapter
- **W3-T015** OpenAI provider adapter
- **W3-T016** Per-persona provider selector in AgentConfigurator

### Track C4: Developer surface (~2 PRs)

- **W3-T017** Public changelog page at `/changelog` (markdown source, static)
- **W3-T018** Dev docs page at `/docs` (MCP tools, persona format, API key usage)

## User stories

_To be populated by ChatPRD._

## Acceptance criteria per task

_To be populated by ChatPRD. One block per task ID above._

## Success metrics

_To be populated by ChatPRD._

## Open questions

_To be populated by ChatPRD._
