# Agent Fixes, Observability, and Experiment Controls

Date: 2026-04-06

## Problem

Three issues with the agent system:

1. **New agents don't activate without refresh.** When a user adds an agent via AgentConfigurator mid-session, the orchestrator is recreated (via useOrchestrator's useEffect on `activeAgents` change), but `trigger('doc-opened')` is never called on the new instance. Only the initial session load and manual unpause call it.

2. **Edits land at end-of-doc instead of intended position.** `resolveInsertPos` in agent-actions.ts does a flawed two-pass heading search. The inner `descendants` walk doesn't properly scope section boundaries -- if no next heading is found after the target, `sectionEnd` falls through to the last node, which can be incorrect. When the heading text from the LLM doesn't exactly match (case, whitespace, truncation), the match fails entirely and falls back to `editor.state.doc.content.size`.

3. **Insufficient logging.** PostHog is integrated but only tracks high-level events. No way to diagnose edit placement failures, agent lifecycle issues, or orchestrator queue behavior in production.

## Design

### Bug Fix 1: Agent activation on config change

**File: `src/hooks/useOrchestrator.ts`**

The existing useEffect (line 128-139) already destroys and recreates the orchestrator when `activeAgents` changes. The fix:

1. Compare previous agents to new agents when the effect runs.
2. Always call `trigger('doc-opened')` on the new orchestrator so it boots up.
3. The orchestrator's `doc-opened` handler already does the right thing: resets counters, classifies doc state, and schedules agent introductions.

Use a `useRef` to track the previous agent list. On change, destroy old orchestrator, create new one, trigger `doc-opened`.

Also fire `events.agentConfigChanged()` when agents change so we see it in PostHog.

### Bug Fix 2: Insert position resolution

**File: `src/agent-actions.ts`, function `resolveInsertPos`**

Replace the current two-pass algorithm with a single-pass approach:

1. Collect all heading positions in one `descendants` walk: `{ text: string, pos: number, nodeSize: number }[]`.
2. Find the target heading using fuzzy match: exact match first, then `includes`, then Levenshtein distance < 3.
3. If found at index `i`, the insert position is the start of heading `i+1` (or end-of-doc if it's the last heading).
4. If not found, log a warning with the target text and available headings, then fall back to end-of-doc.

Add a `resolveInsertPos` return type that includes metadata: `{ pos: number, matched: boolean, matchedHeading?: string, strategy: 'exact' | 'fuzzy' | 'fallback' }`. Use this metadata for logging.

### Logging additions

**File: `src/lib/analytics.ts`**

Add these events:

```typescript
// Edit placement tracking
editPositionResolved: (sessionId, agent, target, resolvedPos, strategy, matched)
editPositionFallback: (sessionId, agent, targetHeading, availableHeadings)

// Agent lifecycle
agentActivated: (sessionId, agent, trigger: 'session-load' | 'config-change' | 'unpause')
agentDeactivated: (sessionId, agent, reason: 'config-change' | 'pause' | 'error-limit')

// Orchestrator internals
orchestratorTurn: (sessionId, agent, trigger, actionType, success, durationMs)
orchestratorQueueDepth: (sessionId, depth, processingAgent)
```

**File: `src/orchestrator.ts`**

Add timing around `processQueue`: record start time before `askAgent`, emit `orchestratorTurn` in the `onDone` callback. Emit `orchestratorQueueDepth` on each `enqueue` call.

**File: `src/agent-actions.ts`**

Emit `editPositionResolved` after `resolveInsertPos` returns. Emit `editPositionFallback` when heading match fails.

### Experiment Controls UI

**New file: `src/ExperimentControls.tsx`**

A panel accessible from the command palette (`/experiments`) or a small beaker icon in the session header. Contains sliders and toggles for runtime orchestrator tuning.

Controls (all session-scoped, stored in React state, passed as `limits` override to orchestrator):

| Control | Type | Default | Range |
|---------|------|---------|-------|
| Auto-activate on add | toggle | on | on/off |
| Insert position strategy | select | fuzzy | strict / fuzzy / always-end |
| Reaction delay | range | 3-5s | 0-10s |
| Heartbeat interval | range | 20-30s | 5-60s |
| Turn limit per agent | number | 4 | 1-8 |
| Exchange limit | number | 4 | 1-8 |
| Verbose logging | toggle | off | on/off |

**State management:**

```typescript
interface ExperimentSettings {
  autoActivateOnAdd: boolean
  insertStrategy: 'strict' | 'fuzzy' | 'always-end'
  reactionDelayMs: [number, number]
  heartbeatDelayMs: [number, number]
  maxTurns: number
  maxExchanges: number
  verboseLogging: boolean
}
```

Stored in `useState` in App.tsx. Passed to `createOrchestrator` via the existing `limits` parameter. The `insertStrategy` and `verboseLogging` need new fields on `OrchestratorLimits` (or a separate config object passed through).

**Verbose logging mode:** When enabled, the orchestrator emits detailed console.log messages for every queue operation, timer, and state transition. Also sends these as PostHog events with a `verbose: true` flag so they can be filtered.

**UI design:**

Flat panel, no shadows. Uses existing CSS design tokens. Collapsible sections. Each control has a label, current value display, and reset-to-default button. Sits in a slide-out from the right edge (like the agent configurator) or as a modal. I'd lean toward putting it in the existing settings modal as a new "Experiments" tab.

### Data flow

```
ExperimentControls (UI) 
  -> experimentSettings state in App.tsx
  -> passed to useOrchestrator as limits override
  -> createOrchestrator receives merged limits
  -> orchestrator uses limits for queue/timer behavior
  -> agent-actions receives insertStrategy for position resolution
  -> analytics.ts emits events with experiment context
```

### Files to modify

1. `src/hooks/useOrchestrator.ts` -- agent activation fix, experiment settings passthrough
2. `src/agent-actions.ts` -- insert position fix, logging
3. `src/orchestrator.ts` -- turn timing, queue depth logging, verbose mode
4. `src/lib/analytics.ts` -- new event helpers
5. `src/types.ts` -- ExperimentSettings type, extended OrchestratorLimits
6. `src/App.tsx` -- experiment settings state, pass to orchestrator
7. `src/ExperimentControls.tsx` -- new component
8. `src/SettingsModal.tsx` -- add Experiments tab (or standalone panel)
9. `src/App.css` or `src/index.css` -- styles for experiment controls

### Testing

- Existing orchestrator tests should still pass (the fixes don't change the public API shape)
- Manual test: add agent mid-session, verify it activates
- Manual test: agent targets `after:SomeHeading`, verify content lands in the right spot
- Check PostHog for new events after deploying

### Out of scope

- Persisting experiment settings to Supabase (keep local for now)
- A/B testing framework (premature)
- Session replay (PostHog already supports it if enabled; not configuring it here)
