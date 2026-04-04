# Agent Intelligence + Multi-Human Live Collaboration

**Date:** 2026-03-20
**Status:** Brainstorm complete, ready for planning

## What We're Building

Two interconnected upgrades to Markup:

### 1. Agent Intelligence System

Transform agents from simple prompt-response actors into intelligent collaborators with visible reasoning, self-reflection, and tool use. Agents have **individual modes** (architect, reviewer, pair-writer) AND the **session has phases** (Discovery > Planning > Drafting > Review) shown as a visible timeline the user can see and manually advance.

**Clickable interactions:** Agents surface decisions as a mix of quick-tap buttons (for simple choices like "Should I focus on the intro or the technical section?") and richer decision cards (for bigger choices like "Here are 3 structural approaches for this doc -- pick one"). Cards include a title, brief description, and preview of the outcome.

**Cutting-edge patterns layered together:**
- **Chain-of-thought plans:** Agents share reasoning steps visibly, build plans collaboratively before acting. Users see the thinking, not just the output.
- **Reflection loops:** Agents review their own output, self-critique, and revise before presenting. Inner monologue visible as collapsible "thinking" blocks in chat.
- **Tool-use agents:** Search the web, pull data, generate images, run calculations as part of their reasoning flow -- not just text generation.

### 2. Multi-Human Live Collaboration

Google Docs meets AI -- two or more co-authors editing a doc together with agents assisting everyone simultaneously. Built on Tiptap's collaboration infrastructure (Y.js + Supabase Realtime or Hocuspocus).

**Conflict model:** When humans give conflicting directions, agents weigh both inputs and make a judgment call, explaining their reasoning in chat. No strict ownership hierarchy.

## Why This Approach

**Visible phase timeline over subtle transitions:** Users need to understand where they are in the process. A document that's in "Discovery" mode behaves fundamentally differently from one in "Review" -- making this explicit prevents confusion and gives users control to skip ahead or go back.

**Buttons + cards over pure text:** The current chat is all text. Agents ask questions but users have to type responses. Clickable options reduce friction dramatically -- most agent questions have 2-4 natural answers. Richer cards work for architectural decisions where users need to compare options before choosing.

**Agent judges conflicts over ownership hierarchy:** In a collaborative doc, having one person's instructions always win defeats the purpose. Agents are well-positioned to synthesize conflicting directions and explain tradeoffs. This makes the collaboration feel egalitarian.

**All three intelligence patterns together:** Chain-of-thought without reflection produces confident but sometimes wrong output. Reflection without tool use limits what agents can verify. Tool use without visible reasoning is a black box. The combination creates agents that think visibly, check themselves, and ground their work in real data.

## Key Decisions

1. **Session phases are explicit** -- visible timeline UI with Discovery > Planning > Drafting > Review. Users can click to advance or go back. Agents adapt behavior per phase (planning phase blocks doc edits, review phase focuses on critique).

2. **Individual agent modes within phases** -- Aiden in "architect mode" during Planning produces outlines and structure; in "reviewer mode" during Review he focuses on technical accuracy. Nova in "researcher mode" during Discovery asks probing questions; in "editor mode" during Drafting she refines prose.

3. **Decision UI is mixed fidelity** -- simple yes/no or pick-one questions get inline button chips below the agent message. Bigger decisions (structural choices, approach selection) get expandable cards with title, description, and optional preview.

4. **Reflection is visible but collapsible** -- agents show a "thinking..." indicator while self-critiquing. The inner monologue is available as a collapsible section, not forced on the user.

5. **Multi-human uses Y.js + Supabase Realtime** -- Tiptap's collaboration extension with Y.js for CRDT-based document sync. Supabase Realtime channels for presence (cursors, who's online) and chat sync.

6. **Agents see all humans** -- agents are aware of all connected users and can address them by name. Each human gets their own cursor color. Agents weigh all human input equally.

7. **Shareable session URLs** -- sessions become joinable via URL. Invitees authenticate via existing Google OAuth. Real-time presence shows who's in the session.

## Architecture Sketch

### Agent Intelligence Layer

```
Session Phase (Discovery > Planning > Drafting > Review)
  |
  v
Agent Mode Selection (per-agent, per-phase)
  |
  v
Prompt Assembly (phase-aware, mode-aware)
  |
  v
Chain-of-Thought Generation (visible reasoning steps)
  |
  v
Tool Use (search, image gen, data pull) if needed
  |
  v
Reflection Loop (self-critique, revise if quality < threshold)
  |
  v
Action Output (chat, edit, decision card, plan steps)
```

### Decision Card Types

**Quick buttons (inline):**
- 2-4 text options below an agent message
- Single click selects, triggers next agent action
- E.g. "What should I focus on?" [Intro] [Technical Details] [Conclusion]

**Decision cards (expandable):**
- Title + 1-2 sentence description per option
- Optional preview (outline, structure sketch)
- Click to select, agents proceed with that approach
- E.g. "I see three ways to structure this PRD:" [User-centric] [Technical-first] [Problem-solution]

### Multi-Human Collaboration Stack

```
Y.js (CRDT document sync)
  + Tiptap Collaboration extension
  + Supabase Realtime (WebSocket transport)
    - Presence channel (cursors, online status)
    - Chat channel (message sync)
    - Phase/state channel (session metadata sync)
```

### Agent Modes by Preset

| Agent | Discovery Mode | Planning Mode | Drafting Mode | Review Mode |
|-------|---------------|---------------|---------------|-------------|
| Aiden | Tech feasibility Q&A | Architecture outline | Implementation detail writing | Technical accuracy review |
| Nova | User research probing | Product strategy framing | Narrative & positioning writing | User impact assessment |
| Lex | Regulatory scoping | Compliance requirement mapping | Legal language drafting | Risk & liability review |
| Mira | UX research questions | Information architecture | Visual/interaction writing | Accessibility & usability review |

## Open Questions

1. **Phase transition triggers** -- should phases auto-advance based on doc state (e.g., enough content = move to Drafting) or purely manual? Hybrid with suggestions?

2. **Reflection depth** -- how many self-critique rounds before an agent presents? One pass? Up to 3 if quality is low? Configurable per agent?

3. **Tool use approval** -- should agents auto-search or ask permission before using tools? Probably auto for search, ask for image generation.

4. **Multi-human scale** -- what's the max number of simultaneous humans? 2-3 is tractable, 10+ changes the dynamic entirely.

5. **Chat vs doc conflicts** -- in multi-human, do agents respond to chat messages from all users or only @-mentioned? Need a prioritization model.

6. **Persistence of decisions** -- when a user clicks a decision card, should the decision be recorded in the doc as a "decision log" section?

7. **Y.js provider choice** -- Supabase Realtime as Y.js transport vs self-hosted Hocuspocus server. Supabase is simpler but may have latency/scale limits.

## Scope for Planning

**Phase 1 (Agent Intelligence):**
- Session phase system with visible timeline UI
- Agent mode configuration per phase
- Decision cards + quick buttons in chat
- Chain-of-thought visible reasoning
- Reflection loops with collapsible inner monologue
- Tool use integration (search already exists, extend with structured data)

**Phase 2 (Multi-Human):**
- Y.js + Tiptap collaboration setup
- Supabase Realtime presence and chat sync
- Multi-cursor with user identification
- Shareable session URLs with auth
- Agent awareness of multiple humans
- Conflict resolution via agent judgment
