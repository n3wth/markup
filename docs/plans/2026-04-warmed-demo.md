## Plan: Warmed Demo Session for First-Time Visitors

### Goal

Put first-time visitors into visible motion immediately. On page load, the workspace should already show partial draft content, an in-progress checklist, agent cursors, and a queued next turn that fires in under 2 seconds. This should reuse the existing turn queue in `src/orchestrator.ts`, not introduce a parallel state machine.

### Storage shape

Phase 1 should store the warmed state as a checked-in fixture JSON, keyed by starter preset. That keeps the implementation local, deterministic, and safe for demo polish work. The fixture should include:

- initial document text
- task checklist with 3 of 5 items complete
- prior chat turns between user and agents
- cursor-ready agent metadata
- one queued next action descriptor

Later phases can move the same payload shape into a persisted session row, but the first version should not depend on Supabase writes or a background seeding job.

### How the client knows it is a warmed demo

Treat warmed demo as an explicit session template mode, not as a heuristic. The entry path for a starter preset should mark the session as `demoMode=true` plus `sessionTemplate=<preset>-warmed`. The client can then hydrate the fixture before booting the orchestrator. This fits the existing `demoMode` and `sessionTemplate` options already accepted by `createOrchestrator()` and avoids special-casing real user sessions after load.

### Starter content

The warmed payload should look like the agents have already completed setup work:

- checklist: 5 tasks total, first 3 completed, fourth active, fifth pending
- document: title plus three short paragraphs already drafted
- chat: 2 to 4 turns showing the user request, an agent plan, and one completed handoff
- cursors: both agents visible, with one agent idle and the next agent marked as about to act

The content should be generic enough to fit the preset promise, but concrete enough that the page feels alive before the user types anything.

### Fast next action

Phase 1 should not bypass the 7-second limiter in `api/gemini.ts`. Instead, the warmed fixture should include one precomputed next action that the client can inject into the existing queue on boot. That gives the appearance of immediate collaboration while preserving current server protections. In `src/orchestrator.ts` terms, this is equivalent to starting with one ready turn already staged rather than waiting for the first live model call.

If Phase 2 needs a live response sooner, pre-warming can happen before the session is handed to the browser, but that is explicitly beyond 1.0 scope.

### Rollout

Phase 1: Static warmed demo

- fixture-backed preset payloads
- immediate doc, checklist, chat, and cursor hydration
- one precomputed next action dispatched through the existing orchestrator path

Phase 2: Semi-live warmed sessions

- server chooses or builds a warmed payload per preset
- first live model call happens after the precomputed turn

Phase 3: Fully real warmed sessions

- persisted warmed sessions that can resume across reloads
- analytics and tuning based on drop-off before first interaction

### Out of scope for 1.0

Anything beyond Phase 1 is out of scope. No Supabase seed pipeline, no rate-limit changes, no new queue system, and no attempt to make warmed sessions resumable. The 1.0 win is simple: a cold visitor lands inside believable motion in under 2 seconds using the orchestration model that already exists.
