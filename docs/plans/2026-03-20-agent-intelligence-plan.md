## Implementation Plan: Agent Intelligence System

Based on thorough exploration of the codebase, here is the plan. The plan targets six areas from the brainstorm: session phases, agent modes, decision cards, chain-of-thought, reflection loops, and tool use. I will note the coordinator instruction to prefer established libraries: for the phase state machine, XState adds a heavy dependency (32KB min) for what is a 4-state linear machine. The existing codebase manages state via plain variables in `orchestrator.ts` already. I recommend `useReducer` with a typed discriminated union instead, which keeps the zero-dependency pattern. If the team wants XState, I will note the integration points.

### 1. Session Phase System with Visible Timeline UI

**Current state:** `SessionPhase` in `agent.ts` is `'planning' | 'active' | 'reviewing'`. The orchestrator tracks it as a local `let sessionPhase` variable. There is no UI. The transition from planning to active is implicit (user sends a substantive message at line 347-355 of `orchestrator.ts`).

**Target state:** Four explicit phases: `discovery | planning | drafting | review`. A clickable timeline bar at the top of the workspace. Users can advance, go back, or let the system suggest transitions. Agents change behavior per phase (see section 2).

**File changes:**

- **`src/types.ts`**: Extend `SessionPhase` to the 4-phase model. Add `PhaseConfig` type.

```
export type SessionPhase = 'discovery' | 'planning' | 'drafting' | 'review'

export interface PhaseConfig {
  label: string
  description: string
  allowedActionTypes: Set<AgentActionType>
  agentModes: Record<string, AgentMode>  // agent name -> mode
}
```

Add the session's current phase to the `Session` type so it persists to Supabase.

- **`src/phase-machine.ts`** (new file): Phase state logic as a pure reducer function. Defines `PHASE_ORDER`, `PHASE_CONFIGS`, and transition rules. This is the central place defining which actions are allowed per phase, what prompts to use, and when to suggest transitions.

```
// State shape
interface PhaseState {
  current: SessionPhase
  history: SessionPhase[]  // for back navigation
  transitionSuggested: boolean
  suggestedNext: SessionPhase | null
}

// Actions
type PhaseAction =
  | { type: 'advance' }
  | { type: 'go-back' }
  | { type: 'jump-to', phase: SessionPhase }
  | { type: 'suggest-transition', next: SessionPhase }
  | { type: 'dismiss-suggestion' }

// Reducer
function phaseReducer(state: PhaseState, action: PhaseAction): PhaseState
```

The reducer is plain TypeScript, no external dependency. It is testable. The orchestrator calls it and holds the state. The UI reads it via a callback.

If the team prefers XState: install `xstate@5` and `@xstate/react`, define a `phaseMachine = createMachine({...})` with 4 states, guards for transition conditions, and use `useMachine()` in App.tsx. The integration points would be the same (orchestrator reads `state.value`, UI renders `state.matches('drafting')`).

- **`src/components/PhaseTimeline.tsx`** (new file): Horizontal phase indicator bar. Four labeled steps: Discovery, Planning, Drafting, Review. Clicking a step triggers `onPhaseChange(phase)`. Current phase is highlighted with the primary agent color. Suggested transitions show a subtle pulse animation. Uses the existing `--surface-*`, `--text-*`, `--border-*` CSS tokens. Pattern: similar to the existing `Timeline.tsx` component (a horizontal bar with interactive elements), but semantic rather than dot-based.

```tsx
interface PhaseTimelineProps {
  currentPhase: SessionPhase
  suggestedNext: SessionPhase | null
  onPhaseChange: (phase: SessionPhase) => void
  onDismissSuggestion: () => void
}
```

- **`src/App.css`**: Add `.phase-timeline` styles. Horizontal flexbox, 4 steps, active/completed/upcoming states. Use existing `--border-default`, `--surface-2`, `--text-primary` tokens. Transition animation uses `--ease-out-expo` already defined in the file.

- **`src/orchestrator.ts`**: Replace the `sessionPhase` local variable with `PhaseState` from the reducer. Add `onPhaseChange` callback to `OrchestratorConfig`. The phase-aware safety net (line 152-164, blocking doc edits during planning) extends to cover all 4 phases:
  - Discovery: only `chat`, `ask`, `search` allowed
  - Planning: only `chat`, `ask`, `plan`, `search`, `propose` allowed
  - Drafting: all actions allowed
  - Review: `read`, `chat`, `replace` (edits framed as suggestions), `search` allowed; no `insert` of new sections

  The transition suggestion logic: after N exchanges in a phase with certain conditions met (e.g., user answered 2+ questions in discovery), the orchestrator calls `phaseReducer({ type: 'suggest-transition', next })` and emits via `onPhaseChange`.

- **`src/App.tsx`**: Add `PhaseTimeline` component between `SessionHeader` and the content row. Wire `phaseState` and `onPhaseChange` through the orchestrator callbacks.

- **`supabase/migrations/003_session_phase.sql`** (new): Add `phase text not null default 'discovery'` column to `sessions` table. Add to `session-store.ts`: `updateSessionPhase(sessionId, phase)`.

**Transition triggers (hybrid: suggested + manual):**
- Discovery -> Planning: When user has provided substantive direction (2+ messages with 5+ words) and agents have asked 2+ clarifying questions. System suggests; user confirms or clicks.
- Planning -> Drafting: When a `plan` action with 3+ steps has been presented and user approved it. Or user clicks directly.
- Drafting -> Review: When doc reaches a word count threshold relative to the plan, or user clicks.
- Review -> Drafting: User clicks back to revise.

### 2. Agent Mode Configuration per Phase

**Current state:** Each agent has a single `persona` string in `AgentConfig`. The `buildPrompt()` function in `agent.ts` uses it unchanged regardless of phase.

**Target state:** Each agent has mode-specific behavior instructions per phase. The prompt builder selects the right mode based on current phase.

**File changes:**

- **`src/types.ts`**: Add `AgentMode` type and extend `AgentConfig`.

```
export type AgentMode = {
  label: string           // e.g. "Architect Mode"
  promptModifier: string  // injected into persona block per phase
  allowedActions: AgentActionType[]  // subset of actions this agent can use in this mode
}
```

- **`src/agent-modes.ts`** (new file): Mode definitions per preset per phase. This is a data file, not logic. Maps `agentName -> phase -> AgentMode`.

```
export const AGENT_MODES: Record<string, Record<SessionPhase, AgentMode>> = {
  Aiden: {
    discovery: { label: 'Tech Feasibility', promptModifier: 'Focus on technical feasibility. Ask about scale, constraints, existing systems. Probe for requirements that will affect architecture decisions.', allowedActions: ['chat', 'ask', 'search'] },
    planning: { label: 'Architect', promptModifier: 'Create outlines and architecture proposals. Define component boundaries, data flow, API contracts. Use plan actions to lay out implementation steps.', allowedActions: ['chat', 'ask', 'plan', 'search', 'propose'] },
    drafting: { label: 'Builder', promptModifier: 'Write implementation details. Specific protocols, data schemas, code-level decisions. Fill in technical sections with concrete content.', allowedActions: ['insert', 'replace', 'read', 'chat', 'search', 'delete'] },
    review: { label: 'Technical Reviewer', promptModifier: 'Review for technical accuracy. Check numbers, verify claims, identify missing error cases. Challenge vague technical language.', allowedActions: ['read', 'replace', 'chat', 'search'] },
  },
  // Nova, Lex, Mira similarly...
}
```

- **`src/agent.ts` (`buildPrompt`)**: Inject the mode modifier after the persona block. Replace the current static persona with `persona + '\n\nCURRENT MODE: ' + mode.label + '\n' + mode.promptModifier`. Also restrict the action menu in the prompt to only show JSON examples for the mode's `allowedActions`.

- **`src/orchestrator.ts`**: When building `AskParams`, look up `AGENT_MODES[agentName][currentPhase]` and pass the mode to `askAgent`. The safety net at line 152 becomes phase-config-driven rather than hardcoded.

- **`src/components/AgentHoverCard.tsx`**: Show current mode label next to agent name (e.g., "Aiden - Architect Mode"). This is a 1-line addition to the existing hover card.

### 3. Decision Cards and Quick Buttons in Chat

**Current state:** The chat has text messages, reasoning chains (collapsible), and proposal approve/reject buttons. No structured choice UI.

**Target state:** Two new message types: `QuickButtons` (2-4 inline chips below a message) and `DecisionCard` (expandable cards with title, description, optional preview).

**File changes:**

- **`src/types.ts`**: Extend `Message` with optional decision data.

```
export interface QuickButton {
  label: string
  value: string  // sent as user instruction when clicked
}

export interface DecisionOption {
  title: string
  description: string
  preview?: string  // optional outline/preview text
}

export interface Decision {
  id: string
  options: DecisionOption[] | QuickButton[]
  type: 'quick' | 'card'
  status: 'pending' | 'selected'
  selectedIndex?: number
}

// Extend Message:
export interface Message {
  // ...existing fields...
  decision?: Decision
}
```

- **`src/agent.ts` (AgentAction)**: Add `decision` field to `AgentAction` interface. Add two new action types: `'decide'` (presents a decision to the user). The JSON schema in the prompt gets a new section:

```
To present options for the user to choose:
{"type":"decide","reasoning":[...],"chatMessage":"<context>","decision":{"type":"quick","options":[{"label":"Intro","value":"Focus on the intro section"},{"label":"Tech Details","value":"Focus on technical details"}]}}

For bigger decisions with descriptions:
{"type":"decide","reasoning":[...],"chatMessage":"<context>","decision":{"type":"card","options":[{"title":"User-centric","description":"Organize around user journeys and pain points","preview":"1. User Problem\n2. Journey Map\n3. Solution"},...]}}
```

- **`src/agent-actions.ts`**: Add handler for `'decide'` type. It emits the chat message with the decision data attached. No editor interaction.

- **`src/components/QuickButtons.tsx`** (new file): Inline button chips below a message. Uses the existing `.chat-suggestion-chip` CSS pattern as a base but with agent-color borders. When clicked, calls `onSelect(value)` which dispatches it as a user message + orchestrator trigger.

```tsx
interface QuickButtonsProps {
  buttons: QuickButton[]
  agentColor: string
  disabled: boolean
  onSelect: (value: string) => void
}
```

- **`src/components/DecisionCards.tsx`** (new file): Expandable option cards. Each card has a title, description, and optional preview (shown on expand). Selecting a card highlights it and grays out others. Uses existing `--surface-card`, `--border-card` tokens.

```tsx
interface DecisionCardsProps {
  options: DecisionOption[]
  agentColor: string
  selectedIndex?: number
  onSelect: (index: number, option: DecisionOption) => void
}
```

- **`src/components/ChatMessage.tsx`**: After the `msg-text` div, render `QuickButtons` or `DecisionCards` based on `m.decision?.type`. When a user selects an option, the parent updates the message's `decision.status` to `'selected'` and sends the selection as a user message to the orchestrator.

- **`src/components/ChatPanel.tsx`**: Add `onDecisionSelect` prop. Wire it through to ChatMessage. The handler: update the message in state (mark selected), send the selected value as a user instruction.

- **`src/App.css`**: Add `.quick-buttons`, `.decision-cards`, `.decision-card`, `.decision-card-selected`, `.decision-card-preview` styles. Follow the existing proposal button pattern (`.msg-proposal-*`) for sizing and spacing.

- **`src/agent.ts` (normalizeAction, validateAction)**: Add `'decide'` to `VALID_ACTION_TYPES`. Add validation: `decision` must have `type` and `options` array with 2-4 entries.

### 4. Chain-of-Thought Visible Reasoning in Chat

**Current state:** Reasoning is already implemented. `AgentAction.reasoning` is an array of 2-3 short strings. `ReasoningChain.tsx` renders them as a collapsible block. The orchestrator wires `onAgentReasoning` to attach reasoning to the next chat message via `pendingReasoning` in `useOrchestrator.ts`.

**Target state:** Extend reasoning to be richer and phase-aware. During discovery/planning, reasoning is more verbose (5-6 steps showing the thought process). During drafting/review, it stays terse (2-3 steps). Add "thinking live" animation where reasoning steps appear one at a time as the agent works.

**File changes:**

- **`src/agent.ts` (buildPrompt)**: Adjust reasoning instructions per phase:
  - Discovery/Planning: `"reasoning" is REQUIRED — 4-6 steps showing your analysis. Show: what the user needs -> what information is missing -> what options exist -> your recommendation.`
  - Drafting: Current 2-3 steps (no change).
  - Review: `"reasoning" is REQUIRED — 3-4 steps showing: what you checked -> what you found -> your assessment.`

  Also increase `maxOutputTokens` from 1200 to 1600 for discovery/planning phases to accommodate longer reasoning.

- **`src/components/ReasoningChain.tsx`**: Add support for live-streaming appearance. New prop `animate?: boolean`. When true, steps appear one at a time with 300ms stagger (CSS `animation-delay`). Add a "Thinking..." header that shows while the agent is processing (before reasoning arrives).

- **`src/components/ChatMessage.tsx`**: Pass `animate={true}` to ReasoningChain for the most recent message from a thinking agent.

- **`src/App.css`**: Add staggered animation keyframes for reasoning steps. Use existing `reasoningReveal` keyframe pattern but add `animation-delay: calc(var(--step-index) * 300ms)`.

### 5. Reflection Loops with Collapsible Inner Monologue

**Current state:** No self-reflection. Agents generate one response and it goes directly to execution.

**Target state:** After generating an action, agents optionally self-critique before presenting. The inner monologue (critique + revision) is visible as a collapsible "Reflecting..." block in chat. Reflection depth: 1 pass by default, up to 2 if quality signals are low.

**File changes:**

- **`src/types.ts`**: Add reflection types.

```
export interface Reflection {
  critique: string
  revised: boolean  // did the agent revise after critique?
  originalAction?: string  // short description of what was first proposed
}

// Extend Message:
export interface Message {
  // ...existing fields...
  reflection?: Reflection
}
```

- **`src/agent-reflection.ts`** (new file): Reflection logic. Takes an `AgentAction` and the current context, makes a second LLM call asking the agent to critique its own output, and optionally returns a revised action.

```ts
export interface ReflectionResult {
  revised: boolean
  critique: string
  originalAction: AgentAction
  revisedAction: AgentAction  // same as original if not revised
}

export async function reflectOnAction(
  action: AgentAction,
  params: AskParams,
  agentMode: AgentMode,
): Promise<ReflectionResult>
```

The reflection prompt is short and focused:

```
You just decided to: [action summary].
Your reasoning was: [reasoning].
Critique this decision in 1-2 sentences. Consider:
- Does this add value or is it noise?
- Is the content specific enough?
- Does it conflict with what's already in the doc?
- Would the user find this helpful right now?

Respond: {"quality":"good"|"revise","critique":"...","revisedAction":{...} (only if quality is "revise")}
```

This call uses a lower temperature (0.3) and lower maxOutputTokens (600).

- **`src/orchestrator.ts`**: After `askAgent()` returns at line 132, before executing, check if reflection should run:
  - Reflection triggers: phase is `review`, OR action is `insert`/`replace` with content > 100 chars, OR agent has been wrong recently (consecutive failures > 0).
  - Skip reflection if: phase is `discovery` (speed matters), or action is `chat`/`ask` (low stakes), or doc is < 200 words (not enough to critique against).
  - If reflection runs and returns `revised: true`, use the revised action. Emit the reflection as a callback so the UI can show it.

Add `onReflection` callback to `OrchestratorConfig`:

```ts
onReflection?: (agent: AgentName, reflection: Reflection) => void
```

- **`src/hooks/useOrchestrator.ts`**: Wire `onReflection` to attach the reflection data to the pending message, similar to how `onAgentReasoning` works via `pendingReasoning`.

- **`src/components/ReflectionBlock.tsx`** (new file): Collapsible "Reflected" block. Shows the critique text. If revised, shows a diff-like summary ("Originally wanted to [X], revised to [Y]"). Pattern: same as `ReasoningChain.tsx` (collapsible with chevron), but with a different label and icon.

- **`src/components/ChatMessage.tsx`**: Render `ReflectionBlock` between `ReasoningChain` and `msg-text` when `m.reflection` exists.

- **`src/App.css`**: Add `.reflection-block` styles. Match the `.reasoning-chain` pattern but with a slightly different label color to distinguish thinking from reflecting.

### 6. Tool Use Integration

**Current state:** Search already works via `api/tavily/search.ts`. The `search` action type is handled in `agent-actions.ts` (line 587-618). Results are synthesized into a brief chat message.

**Target state:** Extend tool use with structured data fetching and better result handling. Add a `data-pull` tool type that fetches structured data from URLs (JSON APIs). Search results are stored on the message for re-reference. Agents can chain tool use (search -> synthesize -> cite in doc edit).

**File changes:**

- **`src/agent.ts` (AgentAction)**: Add optional `toolResults` to AgentAction for tracking what tools returned.

```
export interface ToolResult {
  tool: 'search' | 'data-pull'
  query: string
  results: { title: string, url: string, snippet: string }[]
  timestamp: string
}
```

- **`src/types.ts` (Message)**: Add `toolResults?: ToolResult[]` so search results persist on the message and can be re-referenced.

- **`src/agent-actions.ts`**: Refactor the search handler (line 587-618) to:
  1. Store the search results on the message via an extended `onChatMessage` callback that includes `toolResults`.
  2. After search completes, if `action.shouldContinue` is true, re-queue the agent with the search results injected into the context so it can synthesize findings into a doc edit.

- **`api/data-pull.ts`** (new Vercel serverless function): Fetches a URL and returns structured JSON. Sanitizes the response (strips HTML, limits size). Rate limited to prevent abuse.

```ts
// POST /api/data-pull
// Body: { url: string, format: 'json' | 'text' }
// Returns: { data: any, contentType: string, truncated: boolean }
```

- **`src/agent.ts` (buildPrompt)**: Add `data-pull` action to the prompt menu:

```
To fetch data from a URL:
{"type":"data-pull","reasoning":[...],"url":"<api endpoint>","thought":"Fetching data...","shouldContinue":true}
```

Add instructions for when to use tools:
- Search: when needing current market data, competitor info, or verifying claims
- Data-pull: when a specific URL or API has been mentioned in the doc/chat
- Auto-approve for search; data-pull requires the URL to have been mentioned in context (safety)

- **`src/components/ToolResultCard.tsx`** (new file): Renders search/data results inline in chat. Collapsible. Shows source URLs as links, snippets as quoted text. Uses existing `--surface-card` pattern.

- **`src/components/ChatMessage.tsx`**: Render `ToolResultCard` when `m.toolResults` exists.

### Implementation Sequence

1. **Phase 1 (foundation):** `phase-machine.ts` + `types.ts` phase types + `PhaseTimeline.tsx` + migration. Wire into orchestrator. This unlocks everything else.
2. **Phase 2 (modes):** `agent-modes.ts` + `buildPrompt` changes. Depends on phase system being in place.
3. **Phase 3 (decisions):** `QuickButtons.tsx` + `DecisionCards.tsx` + `ChatMessage.tsx` changes + `decide` action type. Independent of phases but better with them.
4. **Phase 4 (reasoning):** Extend `ReasoningChain.tsx` with animation + phase-aware reasoning depth. Small changes, low risk.
5. **Phase 5 (reflection):** `agent-reflection.ts` + `ReflectionBlock.tsx` + orchestrator integration. Depends on phases for trigger conditions.
6. **Phase 6 (tools):** `data-pull` API + `ToolResultCard.tsx` + search chaining. Independent, can be parallelized with phase 3-5.

### Risks and Mitigations

- **Rate limiting with reflection.** Each reflection is an extra Gemini API call. The current rate limiter enforces 7s between calls. With reflection, a single agent turn could take 14s+. Mitigation: reflection calls use a separate counter; only trigger reflection for high-stakes actions (inserts/replaces > 100 chars). Skip in discovery phase entirely.

- **Prompt size with mode modifiers.** Adding mode instructions + richer reasoning requirements increases prompt length. Current `maxOutputTokens` is 1200. Mitigation: mode prompts are 2-3 sentences max. Increase output tokens to 1600 only for planning/discovery.

- **Decision card abuse.** Agents might over-present decisions when chat would suffice. Mitigation: restrict `decide` action to planning and discovery phases only. In drafting/review, agents should just do the work.

- **Phase state persistence.** If the user refreshes mid-session, the phase resets. Mitigation: persist phase to Supabase `sessions.phase` column, load on session restore.

### Critical Files for Implementation
- `/Users/oliver/GitHub/markup/src/orchestrator.ts` - Core loop that must be extended with phase state, reflection hooks, and decision routing
- `/Users/oliver/GitHub/markup/src/agent.ts` - Prompt builder that needs phase-aware mode injection, decision action types, and reflection prompts
- `/Users/oliver/GitHub/markup/src/types.ts` - Type definitions for phases, decisions, reflections, tool results that all other files depend on
- `/Users/oliver/GitHub/markup/src/components/ChatMessage.tsx` - Rendering hub where QuickButtons, DecisionCards, ReflectionBlock, and ToolResultCard all attach
- `/Users/oliver/GitHub/markup/src/agent-actions.ts` - Execution layer that needs the `decide` action handler and search result chaining
