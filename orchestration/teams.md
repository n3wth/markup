# Engineer teams

48 named engineer-agents + 6 reviewers. Organized by track. Each team owns a track's PRs; within a team, PRs serialize when they touch the same module.

## Naming convention

Team names are nouns. Engineer names are single-word, memorable, and tracked in PR attribution (commit trailer or PR body).

## Foundry (Wave 0 — de-monolith, CI, tests)

- **Anvil** — CI workflow (W0-T001)
- **Cleaver** — turn queue / heartbeat / rate-limiter extractions (W0-T002-T004)
- **Chisel** — phase dispatch / reaction router / editor lock (W0-T005-T007)
- **Splitter** — App.tsx hooks extraction (W0-T008-T010)
- *(Shared on W0-T011-T016 — tests, provider seam, PRD infra, restart test)*

## Project Scaffolding (A1 — projects)

- **Beam** — schema + RLS (W1-T001-T002)
- **Joist** — session-store + dashboard (W1-T003-T004)
- **Rafter** — sidebar + move/archive (W1-T005-T008)

## Social Fabric (A2+A3 — sharing + multiplayer)

- **Herald** — share tokens + modal (W1-T009-T011)
- **Steward** — roles + revoke + shared-with-me (W1-T012-T015)
- **Weaver** — realtime human presence + conflict (W1-T016-T020)

## Portable Output (A4 — export)

- **Scribe** — MD + HTML export (W1-T021-T022)
- **Press** — PDF + snapshot URL + modal (W1-T023-T025)

## Time Machine (A5 — history)

- **Cairn** — schema + snapshot write (W1-T026-T027)
- **Oracle** — UI + diff + restore (W1-T028-T030)

## Findable (A6 — search)

- **Compass** — search backend (W1-T031)
- **Lantern** — search UI + palette + shortcuts + recents (W1-T032-T034)

## Recall (B1 — memory)

- **Mnemon** — schema + write (W2-T001-T002)
- **Echo** — retrieval + per-user memory (W2-T003-T004)
- **Forget-me** — UI, forget command, embedding provider (W2-T005-T007)

## Deliberate (B2 — planning)

- **Surveyor** — plan schema + entrypoint (W2-T008-T009)
- **Steps** — plan UI + approval + replay (W2-T010-T012)

## Toolsmith (B3 — tools)

- **Forge** — protocol + web search + URL fetch (W2-T013-T015)
- **Lathe** — project retrieval + sandbox + rendering (W2-T016-T018)
- **Vise** — permission prompt + telemetry (W2-T019-T020)

## Disagreement (B4 — conflict)

- **Arbiter** — detection + card UI (W2-T021-T022)
- **Scribe-II** — resolution memory + timeline (W2-T023-T024)

## LoopBack (B5 — multi-turn)

- **Coil** — agent loop + budgets (W2-T025-T026)
- **Bail** — early-exit + BYO-key (W2-T027-T028)

## Open Port (C1 — MCP)

- **Socket** — scaffold + auth (W3-T001-T002)
- **Pipe** — doc tools (W3-T003-T005)
- **Bridge** — session tools + presence + rate limit (W3-T006-T008)

## Persona Vault (C2 — persona portability)

- **Keeper** — schema + export (W3-T009-T010)
- **Courier** — import + share + marketplace (W3-T011-T013)

## Polyglot (C3 — providers)

- **Envoy** — Claude adapter (W3-T014)
- **Emissary** — OpenAI adapter + selector (W3-T015-T016)

## Docwright (C4 + D4 — docs + analytics)

- **Quill** — changelog + dev docs (W3-T017-T018)
- **Gauge** — PostHog events + Langfuse + health dash (W4-T014-T016)

## Showcase (D1+D2 — landing + onboarding)

- **Curator** — hero + use-cases (W4-T001-T002)
- **Usher** — agent showcase + polish + video embed (W4-T003-T005)
- **Greeter** — first-run + nudge + sample + analytics (W4-T006-T009)

## Commerce (D3 — pricing + waitlist)

- **Ledger** — pricing page + gating (W4-T010-T011)
- **Gatekeeper** — waitlist + admin ramp (W4-T012-T013)

## Review Pool (all waves — independent review)

Rotation-based, author ≠ reviewer enforced. Members:

- **Opal** — Claude-family reviewer, in-process Agent tool, fresh context per review
- **Onyx** — openclaw on Mini, alternate Claude family
- **Quartz** — ChatPRD-backed rubric reviewer (checks acceptance criteria vs. PR diff)
- **Jasper** — Gemini reviewer (diversity of view)
- **Slate** — codex reviewer (Wave 2+)
- **Flint** — cursor agent reviewer (Wave 2+)

## Dispatch notes

- At most 18 engineers authoring at peak (post-W0, mid-W1).
- Reviewers pull from queue; no engineer reviews own PR. No same-team reviews except Review Pool members.
- Orchestrator may temporarily assign Review Pool members to authoring if review queue is empty and author queue is hot.
- Team membership is stable across a wave; can rotate between waves.
