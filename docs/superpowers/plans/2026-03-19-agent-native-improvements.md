# Agent-Native Architecture Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Collab's agent-native score from 53% to ~75% by addressing the four weakest areas: CRUD Completeness (13%), Tools as Primitives (23%), Prompt-Native Features (36%), and Action Parity (39%).

**Architecture:** Three workstreams executed in order:
1. **Prompt-native proactivity** — Replace hardcoded Wizard-of-Oz + Heartbeat pattern matchers with prompt-driven observation generation
2. **Agent CRUD** — Give agents the ability to rename docs, manage chat, and read full document structure
3. **Capability discovery** — Add welcome message, `/help` command, agent role hints in @mentions

**Tech Stack:** React 19, TypeScript, Tiptap 3, Supabase, Gemini 2.5 Flash

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/wizard-of-oz.ts` | Delete | Replaced by prompt-driven observations |
| `src/heartbeat.ts` | Rewrite | Single prompt call replaces 17 hardcoded patterns |
| `src/orchestrator.ts` | Modify | Configurable limits, new trigger types, CRUD callbacks |
| `src/agent.ts` | Modify | New action types, extended AskParams, configurable limits |
| `src/agent-actions.ts` | Modify | Handle new action types (rename, delete-message) |
| `src/App.tsx` | Modify | Wire new callbacks, welcome message, agent role hints |
| `src/Sidebar.tsx` | Modify | Agent-triggered rename support |
| `src/types.ts` | Modify | OrchestratorLimits interface |

---

### Task 1: Configurable Orchestrator Limits

Extract hardcoded constants into a config object so limits can be tuned without code changes.

**Files:**
- Modify: `src/orchestrator.ts:47-68`
- Modify: `src/types.ts`

- [ ] **Step 1: Add OrchestratorLimits to types.ts**

```typescript
export interface OrchestratorLimits {
  maxTurns: number
  maxExchanges: number
  maxConsecutiveFailures: number
  heartbeatDelayMs: [number, number] // [min, max]
  reactionDelayMs: [number, number]
}

export const DEFAULT_LIMITS: OrchestratorLimits = {
  maxTurns: 4,
  maxExchanges: 4,
  maxConsecutiveFailures: 3,
  heartbeatDelayMs: [20000, 30000],
  reactionDelayMs: [3000, 5000],
}
```

- [ ] **Step 2: Update OrchestratorConfig to accept limits**

In `orchestrator.ts`, add `limits?: Partial<OrchestratorLimits>` to `OrchestratorConfig`. Replace all hardcoded constants with `limits.maxTurns`, etc. Merge with defaults:

```typescript
const limits = { ...DEFAULT_LIMITS, ...config.limits }
```

- [ ] **Step 3: Replace all constant references**

Replace `MAX_TURNS` with `limits.maxTurns`, `MAX_EXCHANGES` with `limits.maxExchanges`, etc. throughout orchestrator.ts. Keep `demoMode` as an override that sets higher limits.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/orchestrator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator.ts src/types.ts
git commit -m "refactor: extract orchestrator limits into configurable object"
```

---

### Task 2: Prompt-Native Heartbeat (Replace Wizard-of-Oz + Heartbeat)

Replace 17 hardcoded regex pattern matchers with a single prompt-driven observation call.

**Files:**
- Delete: `src/wizard-of-oz.ts`
- Rewrite: `src/heartbeat.ts`
- Modify: `src/orchestrator.ts` (heartbeat integration)

- [ ] **Step 1: Rewrite heartbeat.ts as prompt-based observer**

```typescript
import { askAgent, type AskParams } from './agent'

export async function generateObservation(
  docText: string,
  recentMessages: { from: string; text: string }[],
  agentName: string,
  persona: string,
  otherAgents: string[],
): Promise<string | null> {
  // Skip if doc is empty or very short
  if (docText.trim().length < 50) return null

  // 30% skip rate to avoid over-observing
  if (Math.random() < 0.3) return null

  const params: AskParams = {
    agentName,
    ownerName: agentName,
    docText,
    chatHistory: recentMessages,
    trigger: 'autonomous',
    persona,
    otherAgents,
    instruction: `You are scanning the document for ONE specific, actionable observation.
Look for: incomplete sections, unsubstantiated claims, missing stakeholders,
vague timelines, TODOs/placeholders, questions without answers, or gaps
the team hasn't addressed. Be specific — reference exact text.
If the document looks solid, respond with type "chat" and a brief compliment.
Do NOT repeat observations already discussed in recent chat.`,
  }

  try {
    const action = await askAgent(params)
    return action.chatMessage || action.chatBefore || null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update orchestrator heartbeat to use new function**

In `orchestrator.ts`, replace the wizard-of-oz + heartbeat dual-layer with:

```typescript
import { generateObservation } from './heartbeat'

// In heartbeat handler (around line 340):
const observation = await generateObservation(
  config.getDocText(),
  config.getMessages().slice(-10),
  agent.name,
  agent.persona,
  agentNames.filter(n => n !== agent.name),
)
if (observation) {
  config.onChatMessage(agent.name, observation)
}
```

- [ ] **Step 3: Remove wizard-of-oz.ts import and usage**

Remove all references to `detectObservations` from orchestrator.ts. Delete `src/wizard-of-oz.ts`.

- [ ] **Step 4: Run tests, fix any wizard-of-oz references**

```bash
npm run build
npx vitest run
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace hardcoded pattern matchers with prompt-native heartbeat"
```

---

### Task 3: Agent CRUD — Document Rename

Allow agents to rename the current document via a new `rename` action type.

**Files:**
- Modify: `src/agent.ts:104-117` (AgentAction type)
- Modify: `src/agent.ts:212-242` (buildPrompt output format)
- Modify: `src/agent-actions.ts` (handle rename)
- Modify: `src/orchestrator.ts` (add onRenameSession callback)

- [ ] **Step 1: Add rename to AgentAction type**

```typescript
export interface AgentAction {
  type: 'insert' | 'replace' | 'read' | 'chat' | 'search' | 'rename'
  // ... existing fields ...
  newTitle?: string  // for rename action
}
```

- [ ] **Step 2: Add rename to buildPrompt output format**

In the JSON response format section of buildPrompt, add:

```
- rename: { "type": "rename", "newTitle": "Better Document Title", "reasoning": [...] }
  Use when the current title doesn't match the document's actual content.
```

- [ ] **Step 3: Add onRenameSession to OrchestratorConfig**

```typescript
export interface OrchestratorConfig {
  // ... existing ...
  onRenameSession?: (newTitle: string) => void
}
```

- [ ] **Step 4: Handle rename in executeAgentAction**

In agent-actions.ts, add a case for rename:

```typescript
if (action.type === 'rename' && action.newTitle) {
  callbacks.onChatMessage(agentName, `Renamed document to "${action.newTitle}"`)
  callbacks.onDone(true)
  return
}
```

The actual rename is handled by the orchestrator callback chain (orchestrator calls `config.onRenameSession` which calls `updateSessionTitle` in App.tsx).

- [ ] **Step 5: Wire in orchestrator processQueue**

After action execution, check for rename:
```typescript
if (action.type === 'rename' && action.newTitle && config.onRenameSession) {
  config.onRenameSession(action.newTitle)
}
```

- [ ] **Step 6: Wire onRenameSession in App.tsx**

```typescript
onRenameSession: (title) => {
  if (activeSessionRef.current) {
    updateSessionTitle(activeSessionRef.current.id, title)
    setActiveSession(s => s ? { ...s, title } : s)
    setSessions(prev => prev.map(s => s.id === activeSessionRef.current?.id ? { ...s, title } : s))
  }
}
```

- [ ] **Step 7: Build and test**

```bash
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/agent.ts src/agent-actions.ts src/orchestrator.ts src/App.tsx
git commit -m "feat: agents can rename documents via rename action type"
```

---

### Task 4: Inject Session Template + Document Structure

Give agents awareness of what kind of document they're working on and its structure.

**Files:**
- Modify: `src/agent.ts:119-131` (AskParams)
- Modify: `src/agent.ts:144-210` (buildPrompt)
- Modify: `src/orchestrator.ts` (pass template + structure)

- [ ] **Step 1: Extend AskParams**

```typescript
export interface AskParams {
  // ... existing ...
  sessionTemplate?: string  // 'prd' | 'tech-spec' | etc.
  docStructure?: { headings: string[], wordCounts: Record<string, number> }
}
```

- [ ] **Step 2: Add structure extraction utility**

In agent.ts, add:

```typescript
function extractDocStructure(docText: string): { headings: string[], wordCounts: Record<string, number> } {
  const headings: string[] = []
  const wordCounts: Record<string, number> = {}
  const lines = docText.split('\n')
  let currentHeading = ''
  let currentWords = 0

  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)/)
    if (match) {
      if (currentHeading) wordCounts[currentHeading] = currentWords
      currentHeading = match[1].trim()
      headings.push(currentHeading)
      currentWords = 0
    } else {
      currentWords += line.trim().split(/\s+/).filter(Boolean).length
    }
  }
  if (currentHeading) wordCounts[currentHeading] = currentWords

  return { headings, wordCounts }
}
```

- [ ] **Step 3: Inject into buildPrompt**

After the doc text block, add:

```typescript
if (params.sessionTemplate) {
  contextBlock += `\nDOC TYPE: ${params.sessionTemplate}`
}
if (params.docStructure && params.docStructure.headings.length > 0) {
  const outline = params.docStructure.headings
    .map(h => `- ${h} (${params.docStructure!.wordCounts[h] || 0} words)`)
    .join('\n')
  contextBlock += `\nDOC OUTLINE:\n${outline}`
}
```

- [ ] **Step 4: Pass from orchestrator**

In processQueue, add template and structure to askAgent params:

```typescript
const structure = extractDocStructure(docText)
const action = await askAgent({
  // ... existing ...
  sessionTemplate: config.sessionTemplate,
  docStructure: structure,
})
```

Add `sessionTemplate?: string` to `OrchestratorConfig`.

- [ ] **Step 5: Pass template from App.tsx**

```typescript
sessionTemplate: activeSession?.template
```

- [ ] **Step 6: Build and test**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/agent.ts src/orchestrator.ts src/App.tsx
git commit -m "feat: inject session template and doc structure into agent prompt"
```

---

### Task 5: Welcome Message + Capability Discovery

Add a welcome chat message when agents first join a document, and show roles in @mention dropdown.

**Files:**
- Modify: `src/App.tsx` (welcome message on doc open)
- Modify: `src/App.tsx` (mention dropdown with roles)

- [ ] **Step 1: Add welcome message on first doc interaction**

In App.tsx, when a session is opened and chat is empty, fire a welcome message from the first agent:

```typescript
// After orchestrator is created and agents are loaded:
if (messages.length === 0 && activeAgents.length > 0) {
  const lead = activeAgents[0]
  const roles = activeAgents.map(a => `${a.name} (${a.persona.split('.')[0].replace(/^You are \w+, /, '')})`).join(', ')
  const welcome = `Ready to collaborate. Your team: ${roles}. @ mention any of us, or just start writing and we'll review as you go.`
  setMessages(prev => [...prev, { from: lead.name, text: welcome, reasoning: [] }])
}
```

- [ ] **Step 2: Add agent roles to mention dropdown**

In App.tsx, update the MENTION_NAMES array or the mention dropdown rendering to show roles:

```typescript
const MENTION_OPTIONS = activeAgents.map(a => ({
  name: a.name,
  role: a.persona.split('.')[0].replace(/^You are \w+, /, ''),
}))
```

Update the mention dropdown render to show `name — role`:

```tsx
<span>{n.name}</span>
<span className="mention-role">{n.role}</span>
```

- [ ] **Step 3: Add CSS for mention role**

```css
.mention-role {
  font-size: 11px;
  color: var(--text-disabled);
  margin-left: 4px;
}
```

- [ ] **Step 4: Build and test**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: welcome message and agent role hints in mentions"
```

---

### Task 6: Integration Test + Deploy

- [ ] **Step 1: Full build**

```bash
npm run build
npm run test
```

- [ ] **Step 2: Create PR**

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```

- [ ] **Step 4: Verify on production**

1. Open a doc — welcome message appears with agent roles
2. Agents observe doc quality via prompt (not regex)
3. Agent renames doc if title is "Untitled"
4. @mention dropdown shows agent roles
5. Orchestrator limits work (agents stop after 4 turns)

---

## Expected Score Impact

| Principle | Before | After | Delta |
|-----------|--------|-------|-------|
| Action Parity | 39% | ~50% | +11% (rename, welcome) |
| Tools as Primitives | 23% | ~30% | +7% (heartbeat is prompt now) |
| Context Injection | 65% | ~80% | +15% (template, structure, roles) |
| Shared Workspace | 100% | 100% | +0% |
| CRUD Completeness | 13% | ~25% | +12% (rename) |
| UI Integration | 98% | 98% | +0% |
| Capability Discovery | 50% | ~75% | +25% (welcome, roles, mentions) |
| Prompt-Native | 36% | ~55% | +19% (heartbeat prompt-native) |

**Overall: 53% -> ~64%**
