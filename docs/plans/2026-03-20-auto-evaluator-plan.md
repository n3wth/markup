# Auto-Evaluator: Implementation Plan

## Overview

An independent judge system that infers document type, generates a scoring rubric, evaluates per-section quality with inline Tiptap decorations, and feeds scores back into agent prompts to drive self-improvement. Uses Gemini Pro as a separate judge model from the Gemini Flash writing agents.

**Tech Stack:** React 19, TypeScript, Tiptap 3 (ProseMirror decorations), Supabase, Gemini 2.5 Pro (judge), Gemini 2.5 Flash (agents), PostHog analytics.

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/evaluator.ts` | Create | Core evaluator: rubric generation, scoring, prompt builder |
| `src/evaluator-decorations.ts` | Create | Tiptap extension for inline score annotations (margin bars, cards) |
| `src/components/RubricEditor.tsx` | Create | Editable rubric weights UI panel |
| `src/components/ScoreOverlay.tsx` | Create | Expandable feedback card component (hover/click) |
| `src/components/EvaluatorToolbar.tsx` | Create | Evaluate button, overall score badge, toggle |
| `src/types.ts` | Modify | Add Rubric, CriterionScore, EvaluationResult types |
| `src/agent.ts` | Modify | Inject scores into `buildPrompt()` |
| `src/orchestrator.ts` | Modify | Add evaluation triggers, `fix-this` routing |
| `src/hooks/useEvaluator.ts` | Create | React hook managing evaluation state and triggers |
| `src/lib/session-store.ts` | Modify | CRUD for `document_evaluations` table |
| `api/evaluator.ts` | Create | Vercel serverless function proxying Gemini Pro for evaluation |
| `supabase/migrations/003_evaluator_schema.sql` | Create | `document_evaluations` table |
| `vite.config.ts` | Modify | Dev proxy for `/api/evaluator` |
| `src/App.tsx` | Modify | Wire evaluator hook, pass to EditorPanel |
| `src/components/EditorPanel.tsx` | Modify | Render evaluator toolbar and score overlay |
| `src/App.css` | Modify | Styles for score decorations, feedback cards |

## Type Definitions

### Task 1: Add evaluator types to `src/types.ts`

**Files:** `src/types.ts`

Add these interfaces after the existing `TimelineEntry` interface at line 99:

```typescript
// Evaluator types
export interface RubricCriterion {
  id: string
  name: string
  description: string
  weight: number // 0.0 - 1.0, all weights sum to 1.0
  applies_to_sections: string[]
}

export interface Rubric {
  doc_type: string
  doc_type_confidence: number
  criteria: RubricCriterion[]
}

export interface CriterionScore {
  criterion_id: string
  score: number // 1-10
  section: string
  annotation: string
  position: { heading: string; type: 'section-end' }
}

export interface EvaluationResult {
  id: string
  session_id: string
  rubric: Rubric
  overall_score: number
  criteria_scores: CriterionScore[]
  top_improvements: string[]
  evaluated_at: string
}

export type EvaluationTrigger = 'phase-change' | 'manual' | 'periodic'
```

Weights must sum to 1.0. The `position.heading` field maps directly to the heading text found by `extractDocStructure()` in `src/agent.ts` (line 172-219), which already walks the document and collects heading names. The evaluator reuses this same heading-matching strategy.

## Database Schema

### Task 2: Create Supabase migration

**Files:** `supabase/migrations/003_evaluator_schema.sql`

```sql
create table if not exists document_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  trigger text not null default 'manual',
  rubric jsonb not null,
  overall_score numeric(3,1) not null,
  criteria_scores jsonb not null,
  top_improvements jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now()
);

create index idx_evaluations_session
  on document_evaluations(session_id, evaluated_at desc);
```

Single table. Rubric and scores stored as JSONB columns matching the TypeScript types above. Each row is one evaluation snapshot, enabling score history over time. No separate rubric table needed since rubrics are regenerated per evaluation (cached on the client, not in the DB).

RLS matches the existing permissive pattern from `001_initial_schema.sql`:

```sql
alter table document_evaluations enable row level security;
create policy "public_evaluations" on document_evaluations
  for all using (true) with check (true);
```

### Task 3: Add session-store CRUD

**Files:** `src/lib/session-store.ts`

Add after the `loadAgentPersonas` function (line 184):

```typescript
/* Document Evaluations */

export async function saveEvaluation(
  eval: Omit<EvaluationResult, 'id'>
): Promise<EvaluationResult> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('document_evaluations')
      .insert({
        session_id: eval.session_id,
        trigger: 'manual',
        rubric: eval.rubric,
        overall_score: eval.overall_score,
        criteria_scores: eval.criteria_scores,
        top_improvements: eval.top_improvements,
      })
      .select()
      .single()
    if (error) throw error
    return data
  })
}

export async function loadLatestEvaluation(
  sessionId: string
): Promise<EvaluationResult | null> {
  const { data, error } = await supabase
    .from('document_evaluations')
    .select('*')
    .eq('session_id', sessionId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function loadEvaluationHistory(
  sessionId: string,
  limit = 10
): Promise<EvaluationResult[]> {
  const { data, error } = await supabase
    .from('document_evaluations')
    .select('id, overall_score, evaluated_at')
    .eq('session_id', sessionId)
    .order('evaluated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
```

Uses `.maybeSingle()` for loads (matching existing pattern at line 105 of session-store.ts).

## API Endpoint

### Task 4: Create evaluator API proxy

**Files:** `api/evaluator.ts`

Follow the exact same structure as `api/gemini.ts` (lines 1-141) but targeting Gemini Pro instead of Flash. Key differences:

```typescript
const JUDGE_MODEL = 'gemini-2.5-pro'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`
```

The handler accepts two request shapes distinguished by a `type` field in the body:

1. `type: 'rubric'` -- rubric generation (receives document text, metadata, agent specialties)
2. `type: 'score'` -- scoring against rubric (receives document text and rubric)

Both share the same Gemini Pro proxy with Langfuse tracing (copy the `propagateAttributes` + `startActiveObservation` pattern from `api/gemini.ts` lines 37-81). The trace name should be `evaluator-rubric` or `evaluator-score`.

PostHog tracking should use the existing pattern from `api/gemini.ts` lines 87-103, with `$ai_model: JUDGE_MODEL` and a custom `evaluation_type` property.

Temperature: 0.3 (lower than agents' 0.7 for consistent scoring). Max output tokens: 2000 (rubrics and scores are larger than agent actions).

`generationConfig.responseMimeType` should be `'application/json'` to force structured JSON output, matching the agent proxy pattern.

### Task 5: Add dev proxy in vite.config.ts

**Files:** `vite.config.ts`

Add a new proxy entry alongside the existing `/api/gemini` proxy at line 117:

```typescript
'/api/evaluator': {
  target: 'https://generativelanguage.googleapis.com',
  changeOrigin: true,
  rewrite: () => `/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
},
```

Also update the dev middleware (currently only `/api/score` at line 19) to handle `/api/evaluator` in dev mode. In dev, it can either proxy through to the real Gemini Pro API (like the image proxy does) or return a mock evaluation for offline development.

## Core Evaluator Module

### Task 6: Create `src/evaluator.ts`

**Files:** `src/evaluator.ts`

This is the core module. It follows the same pattern as `src/agent.ts`: prompt builder + API caller + response parser.

**Rubric generation prompt builder:**

```typescript
export function buildRubricPrompt(params: {
  docText: string
  docTitle: string
  templateType?: string
  agentSpecialties: string[]
}): string
```

The prompt instructs Gemini Pro to:
1. Infer the document type from content (not just template label)
2. Generate 5-8 weighted criteria tailored to that doc type
3. Map each criterion to the specific section headings it applies to

Response format matches the `Rubric` type. Use `extractDocStructure()` from `src/agent.ts` (line 172) to get heading names for the prompt -- the evaluator needs to know what sections exist.

**Scoring prompt builder:**

```typescript
export function buildScoringPrompt(params: {
  docText: string
  rubric: Rubric
  docStructure: DocStructure
}): string
```

This prompt sends the full document plus rubric, and asks for per-criterion scores with specific annotations tied to section headings.

**API caller:**

```typescript
export async function evaluateDocument(params: {
  docText: string
  docTitle: string
  templateType?: string
  agentSpecialties: string[]
  sessionId: string
  existingRubric?: Rubric // reuse rubric if doc type hasn't changed
}): Promise<EvaluationResult>
```

Two-phase call:
1. If no `existingRubric`, call rubric generation first
2. Then call scoring with the rubric

Uses its own rate limiter (separate from agents) with 15s min interval. The evaluator should not compete with agent API calls.

**Response parsing:** Apply the same `stripCodeFences()` + `repairJSON()` strategy from `src/agent.ts` (lines 456-722). Extract this into a shared utility or import it.

**Score injection for agent prompts:**

```typescript
export function buildScoreBlock(
  evaluation: EvaluationResult,
  agentName: string,
  agentPersona: string
): string
```

Returns a formatted text block for injection into `buildPrompt()`. Follows the format from the brainstorm doc (lines 123-135):

```
## Document Evaluation (from independent judge)

Overall score: 6.4/10

Lowest-scoring areas:
- Success Metrics (3/10): "Metrics are vague. Need specific targets."
- Risk Analysis (4/10): "Missing quantified impact and mitigation timeline."

Your priority: Address the lowest-scoring criteria relevant to your expertise.
```

The function filters criteria to show only those relevant to the agent's specialty. Match agent specialty by comparing criterion `applies_to_sections` against known agent domains. The `PRESETS` in `AgentConfigurator.tsx` (lines 5-34) define specialties:
- Aiden: technical (architecture, APIs, data models)
- Nova: product (user stories, metrics, adoption)
- Lex: legal (compliance, risk, privacy)
- Mira: design (UX, flows, accessibility)

Map criterion IDs to agent specialties with a simple keyword matcher on `criterion.name` and `criterion.description`.

## Agent Prompt Injection

### Task 7: Modify `buildPrompt()` in `src/agent.ts`

**Files:** `src/agent.ts`

Add a new optional parameter to `AskParams` (after `docState` at line 147):

```typescript
evaluation?: EvaluationResult | null
```

In `buildPrompt()`, after the `contextBlock` construction (around line 260), add:

```typescript
if (params.evaluation) {
  const scoreBlock = buildScoreBlock(
    params.evaluation,
    params.agentName,
    params.persona
  )
  contextBlock += `\n${scoreBlock}`
}
```

This injects the score block into the existing context that agents already see. The score block goes after `DOC STRUCTURE` and before the task block, so agents see it as context alongside doc structure analysis.

### Task 8: Pass evaluation through orchestrator

**Files:** `src/orchestrator.ts`

Add to `OrchestratorConfig` (after `onProposal` at line 34):

```typescript
getEvaluation?: () => EvaluationResult | null
```

In `processQueue()`, when building the `askAgent` call (around line 132), pass the evaluation:

```typescript
evaluation: config.getEvaluation?.() || null,
```

Add a new trigger type `'fix-this'` that routes to the most relevant agent:

```typescript
case 'fix-this': {
  const criterionId = payload?.instruction || ''
  // Find which agent's specialty best matches this criterion
  const targetAgent = findBestAgentForCriterion(criterionId, config.agents)
  if (targetAgent) {
    enqueue({
      agent: targetAgent.name,
      trigger: 'instruction',
      instruction: `The document evaluator flagged "${criterionId}" as a low-scoring area. Review and improve this section.`,
    })
  }
  break
}
```

The `findBestAgentForCriterion()` helper matches criterion domains to agent specialties using the keyword approach described in Task 6. If no clear match, defaults to the first agent.

## Tiptap Decorations

### Task 9: Create `src/evaluator-decorations.ts`

**Files:** `src/evaluator-decorations.ts`

Follow the `AgentCursors` extension pattern from `src/agent-cursor.ts` exactly. Key structural elements to replicate:

1. **Extension with storage** (like `agent-cursor.ts` lines 96-100):
```typescript
export const EvaluatorDecorations = Extension.create({
  name: 'evaluatorDecorations',
  addStorage() {
    return { scores: [] as CriterionScore[], visible: true }
  },
```

2. **Commands** (like `agent-cursor.ts` lines 102-119):
```typescript
addCommands() {
  return {
    setEvaluationScores: (scores: CriterionScore[]) => ({ editor }) => { ... },
    clearEvaluationScores: () => ({ editor }) => { ... },
    toggleScoreVisibility: () => ({ editor }) => { ... },
  }
}
```

3. **ProseMirror Plugin with decorations** (like `agent-cursor.ts` lines 126-197):

For each `CriterionScore`, the plugin:

a. Finds the heading position matching `score.position.heading` by walking `state.doc.descendants()` (same approach as `agent-actions.ts` line 348-377 for `after:` targeting).

b. Finds the end of that section (next heading or doc end).

c. Creates a `Decoration.widget()` at section-end position with:
   - A colored margin bar (`div` element) positioned absolutely in the right margin
   - Color: green (#30d158) for 8-10, yellow (#ffd60a) for 5-7, red (#ff6961) for 1-4
   - These colors already exist as CSS variables: `--agent-aiden`, `--agent-mira`, `--agent-nova`

d. The widget DOM element gets `data-criterion-id` and `data-score` attributes for the React overlay to hook into.

4. **TypeScript declaration** (like `agent-cursor.ts` lines 200-207):
```typescript
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    evaluatorDecorations: {
      setEvaluationScores: (scores: CriterionScore[]) => ReturnType
      clearEvaluationScores: () => ReturnType
      toggleScoreVisibility: () => ReturnType
    }
  }
}
```

### Task 10: Register extension in App.tsx

**Files:** `src/App.tsx`

Import `EvaluatorDecorations` and add it to the `useEditor` extensions array at line 68, alongside `AgentCursors` and `DocMinimap`:

```typescript
extensions: [
  StarterKit,
  Placeholder.configure({ ... }),
  AgentCursors,
  DocMinimap.configure({ ... }),
  EvaluatorDecorations,
],
```

## UI Components

### Task 11: Create `src/components/EvaluatorToolbar.tsx`

**Files:** `src/components/EvaluatorToolbar.tsx`

A small toolbar section added to `EditorPanel`'s toolbar area. Contains:

1. **Evaluate button** -- triggers manual evaluation. Disabled while evaluating. Shows spinner during evaluation (follow the pattern from `driveStatus` spinner in `EditorPanel.tsx` line 147).

2. **Overall score badge** -- displays current score (e.g., "6.4/10") with background color matching the score range. Only visible when scores exist.

3. **Toggle button** -- show/hide inline annotations. Calls `editor.commands.toggleScoreVisibility()`.

Props:
```typescript
interface EvaluatorToolbarProps {
  evaluating: boolean
  evaluation: EvaluationResult | null
  onEvaluate: () => void
  onToggleScores: () => void
  scoresVisible: boolean
  onOpenRubric: () => void
}
```

### Task 12: Create `src/components/ScoreOverlay.tsx`

**Files:** `src/components/ScoreOverlay.tsx`

A React component that renders expandable feedback cards on top of the editor. Uses a portal to render into `.doc-body` so it can position relative to the decoration widgets.

On hover over a margin bar decoration:
- Show a floating card with: criterion name, score (1-10 with color), annotation text
- Position relative to the decoration element using `getBoundingClientRect()`

On click:
- Card stays open (pinned)
- Shows a "Fix this" button at the bottom

"Fix this" click:
- Calls `orchestratorRef.current.trigger('fix-this', { instruction: criterionId })`
- The orchestrator routes to the best-matched agent (Task 8)

Follow the tooltip pattern from `doc-minimap.ts` (lines 218-227) for hover positioning.

### Task 13: Create `src/components/RubricEditor.tsx`

**Files:** `src/components/RubricEditor.tsx`

A modal/panel (follow the `SettingsModal` lazy-loaded pattern from `App.tsx` line 17) that displays the current rubric and allows editing:

1. **Doc type display** -- shows inferred type with confidence. User can override via a dropdown.

2. **Criteria list** -- each criterion shows:
   - Name (editable text input)
   - Description (editable)
   - Weight (range slider, 0-100%)
   - Applies-to sections (multi-select of current headings from `extractDocStructure()`)
   - Delete button

3. **Add criterion** button at bottom.

4. **Weight normalization** -- when any weight changes, normalize all weights to sum to 1.0.

5. **Re-evaluate button** -- triggers a new evaluation with the edited rubric.

The rubric is passed as a prop and changes are propagated back via `onChange`. The edited rubric is stored in the evaluator hook state and passed to subsequent evaluations.

## React Hook

### Task 14: Create `src/hooks/useEvaluator.ts`

**Files:** `src/hooks/useEvaluator.ts`

Manages all evaluator state. Follow the `useOrchestrator` pattern from `src/hooks/useOrchestrator.ts`.

```typescript
interface UseEvaluatorOptions {
  editorRef: React.RefObject<Editor | null>
  activeSessionRef: React.RefObject<Session | null>
  activeAgents: AgentConfig[]
}

interface UseEvaluatorReturn {
  evaluation: EvaluationResult | null
  evaluating: boolean
  scoresVisible: boolean
  rubricOverride: Rubric | null
  evaluate: (trigger: EvaluationTrigger) => Promise<void>
  toggleScores: () => void
  setRubricOverride: (rubric: Rubric | null) => void
}
```

Key behaviors:

1. **`evaluate()`** -- calls `evaluateDocument()`, saves result via `saveEvaluation()`, updates editor decorations via `editor.commands.setEvaluationScores()`, tracks with PostHog.

2. **Load on session change** -- when `activeSessionRef.current` changes, load the latest evaluation from Supabase. If found, restore decorations.

3. **Periodic trigger** -- track agent doc edits. After every 5 doc-edit actions (insert/replace), auto-evaluate if the last evaluation is older than 2 minutes. Use a ref counter, not a timer.

4. **Phase change trigger** -- expose a callback for the orchestrator to call when `sessionPhase` transitions to `'reviewing'`.

## Evaluation Triggers

### Task 15: Wire triggers in orchestrator

**Files:** `src/orchestrator.ts`, `src/App.tsx`

Three trigger sources:

1. **Phase change (reviewing)** -- In `orchestrator.ts`, when `sessionPhase` transitions to `'reviewing'`, call a new config callback:
```typescript
onPhaseChange?: (phase: SessionPhase) => void
```
App.tsx wires this to `evaluator.evaluate('phase-change')`.

2. **Manual** -- The evaluate button in `EvaluatorToolbar` calls `evaluator.evaluate('manual')`.

3. **Periodic** -- The `useEvaluator` hook counts doc-edit actions. The orchestrator's `onDocAction` callback (already in `useOrchestrator.ts` line 54) is the right place to increment. Add a new callback:
```typescript
onDocEdit?: () => void
```
In `useEvaluator`, maintain an edit counter ref. When counter hits 5 and last evaluation is >2min old, fire `evaluate('periodic')`. Reset counter after evaluation.

## CSS Styles

### Task 16: Add evaluator styles to `src/App.css`

**Files:** `src/App.css`

Score decoration styles:

```css
/* Evaluator margin bars */
.eval-score-bar {
  position: absolute;
  right: -20px;
  width: 4px;
  border-radius: 2px;
  transition: opacity var(--duration-normal) var(--ease-standard);
  cursor: pointer;
}
.eval-score-bar:hover { opacity: 1; }
.eval-score-bar[data-range="high"] { background: var(--agent-aiden); opacity: 0.5; }
.eval-score-bar[data-range="mid"] { background: var(--agent-mira); opacity: 0.6; }
.eval-score-bar[data-range="low"] { background: var(--agent-nova); opacity: 0.7; }

/* Feedback card */
.eval-feedback-card {
  position: absolute;
  right: -280px;
  width: 260px;
  background: var(--surface-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 12px;
  font-size: 12px;
  z-index: 50;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

/* Fix-this button */
.eval-fix-btn {
  margin-top: 8px;
  padding: 4px 10px;
  font-size: 11px;
  background: var(--surface-3);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
}
.eval-fix-btn:hover { background: var(--accent-container); }
```

Use existing design tokens throughout (surfaces, borders, radii, easing curves, durations). No shadows or gradients beyond the minimal card shadow above.

## Testing

### Task 17: Add evaluator tests

**Files:** `src/__tests__/evaluator.test.ts`

Follow the existing test pattern from `src/__tests__/orchestrator.test.ts`:

1. Mock the fetch API (evaluator calls `/api/evaluator`)
2. Test rubric prompt builder produces valid prompts including doc text and headings
3. Test score parsing with valid JSON, truncated JSON, and malformed responses
4. Test `buildScoreBlock()` filters criteria by agent specialty
5. Test weight normalization in rubric editing
6. Test `findBestAgentForCriterion()` routing logic

## Implementation Order

Execute in this order to manage dependencies:

1. **Types** (Task 1) -- no dependencies
2. **Database** (Task 2, 3) -- depends on types
3. **API endpoint** (Task 4, 5) -- depends on types
4. **Core evaluator** (Task 6) -- depends on types, API
5. **Agent prompt injection** (Task 7, 8) -- depends on evaluator
6. **Tiptap decorations** (Task 9, 10) -- depends on types
7. **React hook** (Task 14) -- depends on evaluator, decorations, session-store
8. **UI components** (Task 11, 12, 13) -- depends on hook, decorations
9. **Triggers** (Task 15) -- depends on hook, orchestrator changes
10. **CSS** (Task 16) -- depends on component structure
11. **Tests** (Task 17) -- depends on evaluator module

## Open Questions Resolved

1. **Evaluation frequency during Drafting:** Every 5 agent doc edits, debounced to minimum 2 minutes between evaluations. This balances freshness with cost.

2. **Score history:** Store all evaluations in DB. V1 shows only current scores. Sparkline visualization deferred to v2.

3. **User rubric editing:** Weight sliders + editable criterion names/descriptions. Full rubric editor, not just weights. Users can add/remove criteria.

4. **Multi-human evaluator:** All users in a session see the same scores (single evaluation per session). Per-user rubric priorities deferred.

5. **Cost management:** Evaluations are triggered events (not continuous). Gemini Pro is used only for evaluation, not every agent turn. The separate rate limiter prevents competition with agent calls.

6. **"Fix this" routing:** Match criterion domain keywords against agent specialty descriptions from `PRESETS` in `AgentConfigurator.tsx`. Fallback: first available agent.

### Critical Files for Implementation
- `/Users/oliver/GitHub/markup/src/agent.ts` - Core prompt builder where score block injection happens (buildPrompt function, AskParams interface)
- `/Users/oliver/GitHub/markup/src/agent-cursor.ts` - Reference pattern for Tiptap ProseMirror decorations (Extension.create, Plugin, DecorationSet)
- `/Users/oliver/GitHub/markup/src/orchestrator.ts` - Trigger wiring, fix-this routing, evaluation callback plumbing
- `/Users/oliver/GitHub/markup/api/gemini.ts` - Template for the evaluator API proxy (Langfuse tracing, PostHog, error handling)
- `/Users/oliver/GitHub/markup/src/hooks/useOrchestrator.ts` - Pattern for the useEvaluator hook (ref management, callback wiring, effect lifecycle)