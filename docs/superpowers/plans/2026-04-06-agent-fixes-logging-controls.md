# Agent Fixes, Logging, and Experiment Controls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs (new agents not activating, edits landing at end-of-doc), add structured PostHog logging, and build an experiment controls panel for tuning agent behavior at runtime.

**Architecture:** Four independent workstreams: (1) fix `resolveInsertPos` with single-pass fuzzy heading match, (2) fix `useOrchestrator` to re-trigger agents on config change, (3) add analytics events throughout orchestrator and agent-actions, (4) build ExperimentControls component wired into the orchestrator via a new `ExperimentSettings` type. All changes are additive -- no existing APIs change shape.

**Tech Stack:** React 19, TypeScript, Vitest, PostHog (already integrated), Tiptap/ProseMirror

---

### Task 1: Fix insert position resolution (fuzzy heading match)

**Files:**
- Modify: `src/agent-actions.ts:80-181` (replace `resolveInsertPos` and add `collectHeadingPositions`)
- Test: `src/__tests__/agent-actions.test.ts` (add new describe block)

- [ ] **Step 1: Write failing tests for fuzzy heading match**

Add to `src/__tests__/agent-actions.test.ts`:

```typescript
describe('resolveInsertPos fuzzy matching', () => {
  // Helper to build a mock editor with given headings
  function makeMockEditor(headings: { text: string, pos: number, nodeSize: number }[], docSize: number) {
    return {
      state: {
        doc: {
          content: { size: docSize },
          descendants: (cb: (node: { type: { name: string }, textContent: string, nodeSize: number, isBlock: boolean, isText: boolean, text?: string, content: { size: number } }, pos: number) => boolean | void) => {
            for (const h of headings) {
              cb({
                type: { name: 'heading' },
                textContent: h.text,
                nodeSize: h.nodeSize,
                isBlock: true,
                isText: false,
                content: { size: h.nodeSize - 2 },
              }, h.pos)
            }
          },
        },
      },
    } as never
  }

  it('exact match finds correct section end', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture')
    expect(result.pos).toBe(50)
    expect(result.strategy).toBe('exact')
    expect(result.matched).toBe(true)
  })

  it('case-insensitive match works', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:architecture')
    expect(result.pos).toBe(50)
    expect(result.strategy).toBe('exact')
  })

  it('fuzzy includes-match works when exact fails', () => {
    const editor = makeMockEditor([
      { text: 'System Architecture Overview', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture')
    expect(result.pos).toBe(50)
    expect(result.strategy).toBe('fuzzy')
  })

  it('last heading inserts at end of doc', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Next Steps')
    expect(result.pos).toBe(100)
    expect(result.strategy).toBe('exact')
  })

  it('no match falls back to end of doc', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 0, nodeSize: 20 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:NonExistent')
    expect(result.pos).toBe(100)
    expect(result.strategy).toBe('fallback')
    expect(result.matched).toBe(false)
  })

  it('no position string returns end of doc', () => {
    const editor = makeMockEditor([], 100)
    const result = resolveInsertPos(editor)
    expect(result.pos).toBe(100)
    expect(result.strategy).toBe('fallback')
  })

  it('after-heading returns position after last heading', () => {
    const editor = makeMockEditor([
      { text: 'Title', pos: 0, nodeSize: 10 },
      { text: 'Subtitle', pos: 30, nodeSize: 12 },
    ], 100)
    const result = resolveInsertPos(editor, 'after-heading')
    expect(result.pos).toBe(42)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/agent-actions.test.ts --reporter=verbose`
Expected: New tests fail because `resolveInsertPos` doesn't return `{ pos, strategy, matched }` yet.

- [ ] **Step 3: Export `resolveInsertPos` and rewrite with single-pass algorithm**

In `src/agent-actions.ts`, replace the existing `resolveInsertPos` function (lines 134-181) and add a helper:

```typescript
export interface InsertPosResult {
  pos: number
  matched: boolean
  matchedHeading?: string
  strategy: 'exact' | 'fuzzy' | 'fallback'
}

interface HeadingInfo {
  text: string
  pos: number
  nodeSize: number
}

function collectHeadingPositions(editor: Editor): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ text: node.textContent.trim(), pos, nodeSize: node.nodeSize })
    }
  })
  return headings
}

export function resolveInsertPos(editor: Editor, position?: string): InsertPosResult {
  const docEnd = editor.state.doc.content.size
  if (!position) return { pos: docEnd, matched: false, strategy: 'fallback' }

  if (position === 'after-heading') {
    const headings = collectHeadingPositions(editor)
    if (headings.length === 0) return { pos: docEnd, matched: false, strategy: 'fallback' }
    const last = headings[headings.length - 1]
    return { pos: last.pos + last.nodeSize, matched: true, matchedHeading: last.text, strategy: 'exact' }
  }

  if (position.startsWith('after:')) {
    const target = position.slice(6).trim()
    const targetLower = target.toLowerCase()
    const headings = collectHeadingPositions(editor)

    if (headings.length === 0) {
      console.warn('[agent-actions] resolveInsertPos: no headings in doc, falling back to end')
      return { pos: docEnd, matched: false, strategy: 'fallback' }
    }

    // Pass 1: exact match (case-insensitive)
    let matchIdx = headings.findIndex(h => h.text.toLowerCase() === targetLower)
    let strategy: 'exact' | 'fuzzy' | 'fallback' = 'exact'

    // Pass 2: includes match
    if (matchIdx === -1) {
      matchIdx = headings.findIndex(h => h.text.toLowerCase().includes(targetLower))
      strategy = 'fuzzy'
    }

    // Pass 3: target includes heading text (LLM sometimes returns longer text)
    if (matchIdx === -1) {
      matchIdx = headings.findIndex(h => targetLower.includes(h.text.toLowerCase()))
      strategy = 'fuzzy'
    }

    if (matchIdx === -1) {
      console.warn('[agent-actions] resolveInsertPos: no match for', JSON.stringify(target), 'available:', headings.map(h => h.text))
      return { pos: docEnd, matched: false, strategy: 'fallback' }
    }

    // Insert before the next heading, or at end of doc if this is the last
    const insertPos = matchIdx < headings.length - 1
      ? headings[matchIdx + 1].pos
      : docEnd

    return { pos: insertPos, matched: true, matchedHeading: headings[matchIdx].text, strategy }
  }

  // "end" or unrecognized
  return { pos: docEnd, matched: false, strategy: 'fallback' }
}
```

- [ ] **Step 4: Update callers of `resolveInsertPos` to use `.pos`**

In the same file, update the two call sites:

In the `insert` action handler (~line 394):
```typescript
// Old:
const insertPos = resolveInsertPos(editor, action.position)
// New:
const posResult = resolveInsertPos(editor, action.position)
const insertPos = posResult.pos
if (!posResult.matched && action.position && action.position !== 'end') {
  console.warn(`[agent-actions] insert fallback: wanted "${action.position}", inserting at end`)
}
```

In the `image` action handler (~line 669):
```typescript
// Old:
const insertPos = resolveInsertPos(editor, action.position)
// New:
const insertPos = resolveInsertPos(editor, action.position).pos
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run src/__tests__/agent-actions.test.ts --reporter=verbose`
Expected: All tests pass including new fuzzy matching tests.

- [ ] **Step 6: Run existing orchestrator tests to check no regressions**

Run: `npx vitest run src/__tests__/orchestrator.test.ts --reporter=verbose`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git checkout -b fix/agent-bugs-logging-controls
git add src/agent-actions.ts src/__tests__/agent-actions.test.ts
git commit -m "fix: rewrite resolveInsertPos with single-pass fuzzy heading match

Replaces the broken two-pass heading search that fell through to
end-of-doc when headings didn't exactly match. New algorithm:
1. Collect all headings in one pass
2. Try exact match, then includes, then reverse-includes
3. Return structured result with match metadata for logging"
```

---

### Task 2: Fix agent activation on config change

**Files:**
- Modify: `src/hooks/useOrchestrator.ts:128-139` (fix useEffect to trigger doc-opened)
- Test: `src/__tests__/orchestrator.test.ts` (add activation test)

- [ ] **Step 1: Write failing test for agent re-activation**

Add to `src/__tests__/orchestrator.test.ts`:

```typescript
describe('agent config changes', () => {
  beforeEach(() => {
    timers.length = 0
    nextTimerId = 1
    vi.clearAllMocks()
  })

  it('new orchestrator with additional agent triggers doc-opened behavior', () => {
    // First orchestrator with 1 agent
    const config1 = makeConfig({
      agents: [{ name: 'Aiden', persona: 'Test', owner: 'You', color: '#1a1a1a' }],
    })
    const orch1 = createOrchestrator(config1)
    orch1.trigger('doc-opened')
    const timersAfterFirst = timers.length
    orch1.destroy()
    timers.length = 0

    // Second orchestrator with 2 agents (simulates config change)
    const config2 = makeConfig({
      agents: [
        { name: 'Aiden', persona: 'Test', owner: 'You', color: '#1a1a1a' },
        { name: 'Nova', persona: 'Test', owner: 'You', color: '#ff6961' },
      ],
    })
    const orch2 = createOrchestrator(config2)
    orch2.trigger('doc-opened')

    // Should have timers scheduled for both agents
    expect(timers.length).toBeGreaterThan(timersAfterFirst)
    orch2.destroy()
  })
})
```

- [ ] **Step 2: Run test to verify it passes** (this test validates orchestrator behavior, not the hook)

Run: `npx vitest run src/__tests__/orchestrator.test.ts --reporter=verbose`
Expected: PASS -- the orchestrator itself handles doc-opened correctly; the bug is in the React hook.

- [ ] **Step 3: Fix useOrchestrator to trigger doc-opened on recreation**

In `src/hooks/useOrchestrator.ts`, replace the useEffect (lines 128-139):

```typescript
  const prevAgentsRef = useRef<AgentConfig[]>(activeAgents)

  useEffect(() => {
    if (agentsPausedRef.current) return

    const orch = makeOrchestrator()
    orchestratorRef.current = orch

    // Always trigger doc-opened when orchestrator is (re)created
    // This handles: initial load, agent config changes, unpause
    orch.trigger('doc-opened')

    const prevAgents = prevAgentsRef.current
    const newAgentNames = activeAgents.filter(a => !prevAgents.some(p => p.name === a.name)).map(a => a.name)
    if (newAgentNames.length > 0) {
      console.log('[useOrchestrator] new agents activated:', newAgentNames.join(', '))
      events.agentConfigChanged(activeAgents.length, activeAgents.map(a => a.name))
    }
    prevAgentsRef.current = activeAgents

    return () => {
      if (orchestratorRef.current === orch) {
        orch.destroy()
        orchestratorRef.current = null
      }
    }
  }, [makeOrchestrator, agentsPausedRef, orchestratorRef, activeAgents])
```

Also add the import at the top of the file:

```typescript
import { events } from '../lib/analytics'
```

And add `AgentConfig` to the imports from types if not already there (it's already imported).

- [ ] **Step 4: Remove duplicate doc-opened trigger from handleTogglePause**

In `src/App.tsx`, the `handleTogglePause` callback (around line 298) manually calls `orch.trigger('doc-opened')` after creating a new orchestrator. Since useOrchestrator now does this automatically, remove the duplicate:

```typescript
  const handleTogglePause = useCallback(() => {
    setAgentsPaused(v => {
      const next = !v
      agentsPausedRef.current = next
      if (next) {
        orchestratorRef.current?.destroy()
        orchestratorRef.current = null
        setAgentStates({})
      }
      // On unpause, useOrchestrator's useEffect will recreate and trigger doc-opened
      return next
    })
  }, [orchestratorRef, setAgentStates])
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOrchestrator.ts src/App.tsx src/__tests__/orchestrator.test.ts
git commit -m "fix: activate new agents immediately when added mid-session

useOrchestrator now triggers doc-opened whenever the orchestrator is
recreated (on agent config change or unpause). Previously, new agents
sat idle until page refresh because doc-opened was only called on
initial session load."
```

---

### Task 3: Add structured analytics events

**Files:**
- Modify: `src/lib/analytics.ts` (add new event helpers)
- Modify: `src/orchestrator.ts` (emit turn timing, queue depth, activation events)
- Modify: `src/agent-actions.ts` (emit edit position events)

- [ ] **Step 1: Add new event helpers to analytics.ts**

In `src/lib/analytics.ts`, add to the `events` object:

```typescript
  // Edit placement tracking
  editPositionResolved: (sessionId: string, agent: string, target: string, strategy: string, matched: boolean, matchedHeading?: string) =>
    track('edit_position_resolved', { session_id: sessionId, agent, target, strategy, matched, matched_heading: matchedHeading }),

  editPositionFallback: (sessionId: string, agent: string, targetHeading: string, availableHeadings: string[]) =>
    track('edit_position_fallback', { session_id: sessionId, agent, target_heading: targetHeading, available_headings: availableHeadings }),

  // Agent lifecycle
  agentActivated: (sessionId: string, agent: string, trigger: string) =>
    track('agent_activated', { session_id: sessionId, agent, trigger }),

  agentDeactivated: (sessionId: string, agent: string, reason: string) =>
    track('agent_deactivated', { session_id: sessionId, agent, reason }),

  // Orchestrator internals
  orchestratorTurn: (sessionId: string, agent: string, trigger: string, actionType: string, success: boolean, durationMs: number) =>
    track('orchestrator_turn', { session_id: sessionId, agent, trigger, action_type: actionType, success, duration_ms: durationMs }),

  orchestratorQueueDepth: (sessionId: string, depth: number, processingAgent: string | null) =>
    track('orchestrator_queue_depth', { session_id: sessionId, depth, processing_agent: processingAgent }),
```

- [ ] **Step 2: Add turn timing to orchestrator.ts**

In `src/orchestrator.ts`, add timing in `processQueue`. At the top of the function after `const req = queue.shift()!`:

```typescript
    const turnStartTime = Date.now()
```

At the top of the file, add the import:

```typescript
import { events } from './lib/analytics'
```

In the `onDone` callback inside `processQueue` (around the `log('done', ...)` line), add after the existing log:

```typescript
          const durationMs = Date.now() - turnStartTime
          const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
          const sessionId = sessionMatch?.[1] || ''
          events.orchestratorTurn(sessionId, req.agent, req.trigger, action.type, success !== false, durationMs)
```

In the `enqueue` function, after the existing `log('enqueue', ...)` line, add:

```typescript
    const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
    const sessionId = sessionMatch?.[1] || ''
    events.orchestratorQueueDepth(sessionId, queue.length, processing ? 'processing' : null)
```

- [ ] **Step 3: Add edit position logging to agent-actions.ts**

In `src/agent-actions.ts`, add the import at the top:

```typescript
import { events } from './lib/analytics'
```

In the `insert` action handler, after the `resolveInsertPos` call and the fallback warning, add:

```typescript
    const sessionMatch = window.location.pathname.match(/\/s\/([^/]+)/)
    const sessionId = sessionMatch?.[1] || ''
    events.editPositionResolved(sessionId, agentName, action.position || 'end', posResult.strategy, posResult.matched, posResult.matchedHeading)
    if (!posResult.matched && action.position && action.position !== 'end') {
      const headings = collectHeadingPositions(editor).map(h => h.text)
      events.editPositionFallback(sessionId, agentName, action.position, headings)
    }
```

Also export `collectHeadingPositions` so it's available (it was already added in Task 1).

- [ ] **Step 4: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass. Analytics calls are fire-and-forget, no new test coverage needed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts src/orchestrator.ts src/agent-actions.ts
git commit -m "feat: add structured PostHog events for agent turns, edit placement, queue depth

Tracks: orchestrator_turn (with duration), edit_position_resolved,
edit_position_fallback (with available headings for debugging),
orchestrator_queue_depth. All events include session_id for filtering."
```

---

### Task 4: Add ExperimentSettings type and wire into orchestrator

**Files:**
- Modify: `src/types.ts` (add ExperimentSettings interface)
- Modify: `src/orchestrator.ts` (accept experiment settings, use insertStrategy)
- Modify: `src/agent-actions.ts` (accept insertStrategy parameter)

- [ ] **Step 1: Add ExperimentSettings to types.ts**

In `src/types.ts`, add after the `DEFAULT_LIMITS` export:

```typescript
export interface ExperimentSettings {
  autoActivateOnAdd: boolean
  insertStrategy: 'strict' | 'fuzzy' | 'always-end'
  reactionDelayMs: [number, number]
  heartbeatDelayMs: [number, number]
  maxTurns: number
  maxExchanges: number
  verboseLogging: boolean
}

export const DEFAULT_EXPERIMENTS: ExperimentSettings = {
  autoActivateOnAdd: true,
  insertStrategy: 'fuzzy',
  reactionDelayMs: [3000, 5000],
  heartbeatDelayMs: [20000, 30000],
  maxTurns: 4,
  maxExchanges: 4,
  verboseLogging: false,
}
```

- [ ] **Step 2: Wire insertStrategy into resolveInsertPos**

In `src/agent-actions.ts`, update the `resolveInsertPos` signature:

```typescript
export function resolveInsertPos(editor: Editor, position?: string, insertStrategy?: 'strict' | 'fuzzy' | 'always-end'): InsertPosResult {
  const docEnd = editor.state.doc.content.size
  if (!position) return { pos: docEnd, matched: false, strategy: 'fallback' }

  if (insertStrategy === 'always-end') {
    return { pos: docEnd, matched: false, strategy: 'fallback' }
  }

  if (position === 'after-heading') {
    // ... unchanged
  }

  if (position.startsWith('after:')) {
    const target = position.slice(6).trim()
    const targetLower = target.toLowerCase()
    const headings = collectHeadingPositions(editor)

    if (headings.length === 0) {
      console.warn('[agent-actions] resolveInsertPos: no headings in doc, falling back to end')
      return { pos: docEnd, matched: false, strategy: 'fallback' }
    }

    // Pass 1: exact match (case-insensitive)
    let matchIdx = headings.findIndex(h => h.text.toLowerCase() === targetLower)
    let strategy: 'exact' | 'fuzzy' | 'fallback' = 'exact'

    // Pass 2 & 3: fuzzy matching (only if strategy allows it)
    if (matchIdx === -1 && insertStrategy !== 'strict') {
      matchIdx = headings.findIndex(h => h.text.toLowerCase().includes(targetLower))
      strategy = 'fuzzy'
    }
    if (matchIdx === -1 && insertStrategy !== 'strict') {
      matchIdx = headings.findIndex(h => targetLower.includes(h.text.toLowerCase()))
      strategy = 'fuzzy'
    }

    // ... rest unchanged
  }
```

- [ ] **Step 3: Pass insertStrategy through from orchestrator to agent-actions**

In `src/orchestrator.ts`, add `experiments` to `OrchestratorConfig`:

```typescript
interface OrchestratorConfig {
  // ... existing fields
  experiments?: Partial<import('./types').ExperimentSettings>
}
```

In `createOrchestrator`, extract experiments:

```typescript
  const experiments = { ...DEFAULT_EXPERIMENTS, ...config.experiments }
```

Add the import at the top:

```typescript
import { DEFAULT_EXPERIMENTS } from './types'
```

Also merge experiment limits into the limits object:

```typescript
  const baseLimits = {
    ...DEFAULT_LIMITS,
    ...config.limits,
    maxTurns: config.experiments?.maxTurns ?? config.limits?.maxTurns ?? DEFAULT_LIMITS.maxTurns,
    maxExchanges: config.experiments?.maxExchanges ?? config.limits?.maxExchanges ?? DEFAULT_LIMITS.maxExchanges,
    heartbeatDelayMs: config.experiments?.heartbeatDelayMs ?? config.limits?.heartbeatDelayMs ?? DEFAULT_LIMITS.heartbeatDelayMs,
    reactionDelayMs: config.experiments?.reactionDelayMs ?? config.limits?.reactionDelayMs ?? DEFAULT_LIMITS.reactionDelayMs,
  }
```

In the `executeAgentAction` call inside `processQueue`, pass the strategy. The cleanest way: add `insertStrategy` to the existing call. Update `executeAgentAction` signature in `agent-actions.ts` to accept an optional `insertStrategy` parameter:

```typescript
export function executeAgentAction(
  editor: Editor,
  agentName: string,
  agentColor: string,
  action: AgentAction,
  editorLockRef: { current: string | null },
  timers: Record<string, number>,
  callbacks: ActionCallbacks,
  insertStrategy?: 'strict' | 'fuzzy' | 'always-end',
)
```

Then in the insert handler, pass it through:

```typescript
    const posResult = resolveInsertPos(editor, action.position, insertStrategy)
```

And in orchestrator.ts, pass it:

```typescript
      executeAgentAction(editor, req.agent, agentCfg?.color || '#1a1a1a', action, editorLockRef, typingTimers, callbacks, experiments.insertStrategy)
```

Add the verbose log helper in orchestrator.ts:

```typescript
  function vlog(...args: unknown[]) {
    if (experiments.verboseLogging) console.log('[orch:verbose]', ...args)
  }
```

Sprinkle `vlog` calls at key decision points (queue push, turn start, turn end, timer fire, phase change). Use `vlog` alongside existing `log` -- `log` stays for the important events, `vlog` adds the noisy detail.

- [ ] **Step 4: Update tests for new parameter**

In `src/__tests__/agent-actions.test.ts`, update the `resolveInsertPos` import (it's now exported) and add tests for `insertStrategy`:

```typescript
describe('resolveInsertPos with insertStrategy', () => {
  it('strict strategy skips fuzzy matching', () => {
    const editor = makeMockEditor([
      { text: 'System Architecture Overview', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    // "Architecture" is a substring match, not exact -- strict should fail
    const result = resolveInsertPos(editor, 'after:Architecture', 'strict')
    expect(result.matched).toBe(false)
    expect(result.strategy).toBe('fallback')
  })

  it('always-end strategy ignores position entirely', () => {
    const editor = makeMockEditor([
      { text: 'Architecture', pos: 0, nodeSize: 20 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture', 'always-end')
    expect(result.pos).toBe(100)
    expect(result.strategy).toBe('fallback')
  })

  it('fuzzy strategy is the default behavior', () => {
    const editor = makeMockEditor([
      { text: 'System Architecture Overview', pos: 0, nodeSize: 20 },
      { text: 'Next Steps', pos: 50, nodeSize: 15 },
    ], 100)
    const result = resolveInsertPos(editor, 'after:Architecture', 'fuzzy')
    expect(result.matched).toBe(true)
    expect(result.strategy).toBe('fuzzy')
  })
})
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/orchestrator.ts src/agent-actions.ts src/__tests__/agent-actions.test.ts
git commit -m "feat: add ExperimentSettings type and wire insertStrategy through orchestrator

ExperimentSettings controls: insertStrategy (strict/fuzzy/always-end),
turn limits, exchange limits, reaction delay, heartbeat interval, and
verbose logging. Orchestrator merges experiment overrides into its
config. resolveInsertPos respects the strategy parameter."
```

---

### Task 5: Build ExperimentControls UI component

**Files:**
- Create: `src/ExperimentControls.tsx`
- Modify: `src/App.css` (add styles)

- [ ] **Step 1: Create ExperimentControls component**

Create `src/ExperimentControls.tsx`:

```tsx
import { useState } from 'react'
import type { ExperimentSettings } from './types'
import { DEFAULT_EXPERIMENTS } from './types'

interface Props {
  settings: ExperimentSettings
  onChange: (settings: ExperimentSettings) => void
  onClose: () => void
}

export function ExperimentControls({ settings, onChange, onClose }: Props) {
  const [local, setLocal] = useState(settings)

  const update = <K extends keyof ExperimentSettings>(key: K, value: ExperimentSettings[K]) => {
    const next = { ...local, [key]: value }
    setLocal(next)
    onChange(next)
  }

  const resetAll = () => {
    setLocal({ ...DEFAULT_EXPERIMENTS })
    onChange({ ...DEFAULT_EXPERIMENTS })
  }

  return (
    <div className="exp-overlay" onClick={onClose}>
      <div className="exp-panel" onClick={e => e.stopPropagation()}>
        <div className="exp-header">
          <h2 className="exp-title">Experiments</h2>
          <div className="exp-header-actions">
            <button className="exp-reset" onClick={resetAll}>Reset all</button>
            <button className="exp-close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="exp-body">
          <div className="exp-section">
            <div className="exp-section-label">Agent behavior</div>

            <label className="exp-toggle-row">
              <span className="exp-label">Auto-activate on add</span>
              <button
                className={`exp-toggle ${local.autoActivateOnAdd ? 'exp-toggle-on' : ''}`}
                onClick={() => update('autoActivateOnAdd', !local.autoActivateOnAdd)}
              >
                <span className="exp-toggle-thumb" />
              </button>
            </label>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Turn limit per agent</span>
                <span className="exp-value">{local.maxTurns}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={local.maxTurns}
                onChange={e => update('maxTurns', Number(e.target.value))}
                className="exp-slider"
              />
            </div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Exchange limit</span>
                <span className="exp-value">{local.maxExchanges}</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={local.maxExchanges}
                onChange={e => update('maxExchanges', Number(e.target.value))}
                className="exp-slider"
              />
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Timing</div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Reaction delay</span>
                <span className="exp-value">{(local.reactionDelayMs[0] / 1000).toFixed(1)}s - {(local.reactionDelayMs[1] / 1000).toFixed(1)}s</span>
              </div>
              <div className="exp-range-pair">
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={500}
                  value={local.reactionDelayMs[0]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('reactionDelayMs', [v, Math.max(v, local.reactionDelayMs[1])])
                  }}
                  className="exp-slider"
                />
                <input
                  type="range"
                  min={0}
                  max={10000}
                  step={500}
                  value={local.reactionDelayMs[1]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('reactionDelayMs', [Math.min(local.reactionDelayMs[0], v), v])
                  }}
                  className="exp-slider"
                />
              </div>
            </div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Heartbeat interval</span>
                <span className="exp-value">{(local.heartbeatDelayMs[0] / 1000).toFixed(0)}s - {(local.heartbeatDelayMs[1] / 1000).toFixed(0)}s</span>
              </div>
              <div className="exp-range-pair">
                <input
                  type="range"
                  min={5000}
                  max={60000}
                  step={1000}
                  value={local.heartbeatDelayMs[0]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('heartbeatDelayMs', [v, Math.max(v, local.heartbeatDelayMs[1])])
                  }}
                  className="exp-slider"
                />
                <input
                  type="range"
                  min={5000}
                  max={60000}
                  step={1000}
                  value={local.heartbeatDelayMs[1]}
                  onChange={e => {
                    const v = Number(e.target.value)
                    update('heartbeatDelayMs', [Math.min(local.heartbeatDelayMs[0], v), v])
                  }}
                  className="exp-slider"
                />
              </div>
            </div>
          </div>

          <div className="exp-section">
            <div className="exp-section-label">Debugging</div>

            <div className="exp-field">
              <div className="exp-field-header">
                <span className="exp-label">Insert position strategy</span>
              </div>
              <div className="exp-select-group">
                {(['strict', 'fuzzy', 'always-end'] as const).map(opt => (
                  <button
                    key={opt}
                    className={`exp-select-btn ${local.insertStrategy === opt ? 'exp-select-active' : ''}`}
                    onClick={() => update('insertStrategy', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <label className="exp-toggle-row">
              <span className="exp-label">Verbose logging</span>
              <button
                className={`exp-toggle ${local.verboseLogging ? 'exp-toggle-on' : ''}`}
                onClick={() => update('verboseLogging', !local.verboseLogging)}
              >
                <span className="exp-toggle-thumb" />
              </button>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add CSS styles**

Append to `src/App.css`:

```css
/* Experiment Controls */
.exp-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.exp-panel {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 380px;
  max-height: 80vh;
  overflow-y: auto;
}
.exp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
}
.exp-title {
  font-size: 15px; font-weight: 600; color: var(--text-1);
  margin: 0;
}
.exp-header-actions {
  display: flex; align-items: center; gap: 8px;
}
.exp-reset {
  font-size: 12px; color: var(--text-3);
  background: none; border: none; cursor: pointer;
  padding: 4px 8px; border-radius: 6px;
}
.exp-reset:hover { background: var(--surface-2); color: var(--text-2); }
.exp-close {
  background: none; border: none; cursor: pointer;
  color: var(--text-3); padding: 4px; border-radius: 6px;
  display: flex; align-items: center;
}
.exp-close:hover { background: var(--surface-2); }
.exp-body {
  padding: 12px 20px 20px;
}
.exp-section {
  margin-bottom: 16px;
}
.exp-section:last-child { margin-bottom: 0; }
.exp-section-label {
  font-size: 11px; font-weight: 600; color: var(--text-3);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.exp-field {
  margin-bottom: 12px;
}
.exp-field-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 6px;
}
.exp-label {
  font-size: 13px; color: var(--text-2);
}
.exp-value {
  font-size: 12px; color: var(--text-3); font-variant-numeric: tabular-nums;
}
.exp-slider {
  width: 100%; height: 4px;
  -webkit-appearance: none; appearance: none;
  background: var(--surface-3); border-radius: 2px; outline: none;
}
.exp-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--text-1); cursor: pointer;
  border: 2px solid var(--surface-1);
}
.exp-range-pair {
  display: flex; flex-direction: column; gap: 4px;
}
.exp-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; cursor: pointer;
}
.exp-toggle {
  width: 36px; height: 20px; border-radius: 10px;
  background: var(--surface-3); border: none; cursor: pointer;
  position: relative; transition: background 0.15s ease;
  padding: 0;
}
.exp-toggle-on { background: var(--text-1); }
.exp-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--surface-1); transition: transform 0.15s ease;
}
.exp-toggle-on .exp-toggle-thumb { transform: translateX(16px); }
.exp-select-group {
  display: flex; gap: 4px;
}
.exp-select-btn {
  flex: 1; padding: 6px 8px; font-size: 12px;
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; cursor: pointer; color: var(--text-2);
  transition: all 0.1s ease;
}
.exp-select-btn:hover { border-color: var(--text-3); }
.exp-select-active {
  background: var(--text-1); color: var(--surface-1);
  border-color: var(--text-1);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript or build errors.

- [ ] **Step 4: Commit**

```bash
git add src/ExperimentControls.tsx src/App.css
git commit -m "feat: add ExperimentControls panel UI

Flat modal with sliders and toggles for: auto-activate, turn limit,
exchange limit, reaction delay, heartbeat interval, insert strategy
(strict/fuzzy/always-end), and verbose logging. Session-scoped state,
not persisted."
```

---

### Task 6: Wire ExperimentControls into App.tsx

**Files:**
- Modify: `src/App.tsx` (add experiment state, pass to orchestrator, add UI trigger)
- Modify: `src/hooks/useOrchestrator.ts` (pass experiments through to createOrchestrator)
- Modify: `src/CommandPalette.tsx` (check if experiments command already exists, or add one)

- [ ] **Step 1: Add experiment state to App.tsx**

In `src/App.tsx`, add imports:

```typescript
import type { ExperimentSettings } from './types'
import { DEFAULT_EXPERIMENTS } from './types'
const ExperimentControls = lazy(() => import('./ExperimentControls').then(m => ({ default: m.ExperimentControls })))
```

Add state after the existing state declarations (around line 61):

```typescript
  const [experimentSettings, setExperimentSettings] = useState<ExperimentSettings>({ ...DEFAULT_EXPERIMENTS })
  const [showExperiments, setShowExperiments] = useState(false)
```

- [ ] **Step 2: Pass experiments to useOrchestrator**

Update the `useOrchestrator` call to include experiments:

```typescript
  const { makeOrchestrator } = useOrchestrator({
    editorRef,
    messagesRef,
    activeAgents,
    activeSessionRef,
    agentsPausedRef,
    setAgentStates,
    setTimeline,
    setMessages,
    setSessions,
    setActiveSession,
    orchestratorRef,
    experimentSettings,
  })
```

In `src/hooks/useOrchestrator.ts`, add to the options interface:

```typescript
  experimentSettings?: import('../types').ExperimentSettings
```

In `makeOrchestrator`, pass experiments to `createOrchestrator`:

```typescript
  const makeOrchestrator = useCallback(() => {
    return createOrchestrator({
      // ... existing config
      experiments: experimentSettings,
    })
  }, [activeAgents, editorRef, messagesRef, activeSessionRef, setAgentStates, setTimeline, setMessages, setSessions, setActiveSession, experimentSettings])
```

- [ ] **Step 3: Add ExperimentControls to the render tree and command palette**

In `App.tsx`, add the modal render (after the SettingsModal block):

```tsx
      {showExperiments && (
        <Suspense>
          <ExperimentControls
            settings={experimentSettings}
            onChange={setExperimentSettings}
            onClose={() => setShowExperiments(false)}
          />
        </Suspense>
      )}
```

Add the experiments command to the command palette array:

```typescript
{ id: 'experiments', label: 'Experiments — tune agent behavior', action: () => setShowExperiments(true) },
```

- [ ] **Step 4: Run build and verify**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/hooks/useOrchestrator.ts
git commit -m "feat: wire ExperimentControls into App and orchestrator

Experiment settings state in App.tsx, passed through useOrchestrator
to createOrchestrator. Accessible via Cmd+K > Experiments. Changes
take effect on next orchestrator recreation (which happens immediately
since experimentSettings is in the useCallback deps)."
```

---

### Task 7: Final integration test and cleanup

**Files:**
- All modified files
- Test: run full suite

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors. Fix any that appear.

- [ ] **Step 4: Manual smoke test checklist**

Start dev server: `npm run dev`

Test the three fixes:
1. Open a session with 1 agent. Add a second agent via configurator. Verify the new agent starts contributing (chat message or doc edit) without refresh.
2. Create a doc with 2+ headings. Send a message asking an agent to add content after a specific heading. Verify content lands in the right section, not at the end.
3. Open browser console. Open Experiments panel (Cmd+K > Experiments). Toggle verbose logging on. Verify detailed `[orch:verbose]` messages appear in console on agent actions.
4. Change insert strategy to "strict" in experiments. Ask agent to insert after a heading using a slightly different name. Verify it falls back to end (strict mode). Switch to "fuzzy" and retry -- should match.
5. Adjust turn limit slider to 1. Verify agents stop after 1 autonomous turn.

- [ ] **Step 5: Commit any smoke test fixes**

```bash
git add -A
git commit -m "chore: smoke test fixes"
```
