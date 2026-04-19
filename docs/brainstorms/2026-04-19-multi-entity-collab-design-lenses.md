# Multi-Entity Collaboration — Design & Social Lenses

**Date:** 2026-04-19
**Status:** brainstorm
**Companions:** [2026-03-20-multi-human-plan.md](../plans/2026-03-20-multi-human-plan.md) (transport/CRDT),
[2026-03-20-agent-intelligence-and-multiplayer-brainstorm.md](./2026-03-20-agent-intelligence-and-multiplayer-brainstorm.md)

## Why this doc exists

The existing multi-human plan covers transport (Hocuspocus + Y.js) and data
model. It is largely silent on the *experience* of mixing 3-5 humans with 4
agents in the same doc. This brainstorm captures three independent lenses
(product-design, social/epistemic, engineering-shippability) so we have a
durable artifact to argue with when we decide what to build next.

A first concrete step shipped alongside this doc: a `?view=1` spectator
mode that lets a second human tail a live session read-only. Everything
below assumes that baseline and extends from it.

---

## Lens 1 — Product-designer (peers, affordances, chrome)

**Through-line:** humans feel like co-authors with each other and conductors
of agents. Agents are powerful but spatially and temporally contained to
the margins, the pauses, and the unclaimed work.

1. **The Margin Rail.** Dedicated 40px right-side rail. Humans stay in the
   text (colored carets, name tags). Agents get avatars anchored to
   paragraphs, drifting up and down as they "read." Proposals extrude ghost
   suggestions inward; chat blooms as thought bubbles. Collapsible to a
   single "4 agents nearby" pill when a human wants focus.

2. **Proposal cards with a single claimed reviewer.** When an agent
   proposes an edit, the card shows three states — *unclaimed* (grey),
   *claimed* (one avatar latches on), *resolved*. Claiming is one click or
   a 3s hover. Only the claimer's Approve button is active; others see
   "Priya is deciding" plus a "Nudge" affordance. Unclaimed cards age:
   amber at 2 min, auto-route to the doc owner at 5.
   Prevents both the simultaneous-approve race and the nobody-feels-
   responsible anti-pattern.

3. **Typing force-field.** Agents have a 400px "politeness radius" around
   any active human caret. Inside it they won't edit, won't pop proposals,
   won't even render. They queue intent as a greyed-out "Aiden has a
   thought here" marker that materializes when the human moves on or idles
   for 8s. Humans don't yield to each other this way — humans stay
   co-equal.

4. **Provenance ribbon.** Toggle-on view that tints each paragraph by its
   last-toucher. Hover a paragraph for a stacked timeline:
   "Sarah drafted → Aiden tightened → Priya edited → Nova flagged." A new
   joiner hits `⌘\` and the doc becomes legible as *history*, not just
   state.

5. **Team volume dial.** Shared per-doc dial with four notches — *Silent /
   Whisper / Discuss / Active*. Anyone can move it; "Priya set agents to
   Whisper" toast. Brainstorming wants Active, final legal review wants
   Silent. Per-user mute overrides exist but are secondary.

## Lens 2 — Thought-leader (stance, authority, memory, dissent)

**Through-line:** the design work isn't making agents more agent-like. It's
building the *social scaffolding* that lets a mixed group have a legible
relationship to each other and the artifact. Agent-washing is prevented by
structural asymmetries that keep humans in the load-bearing roles.

1. **Stance slots, not neutrality.** Every agent must declare a stance on
   every live disagreement, rendered as a badge
   ("Aiden: leans Option B, 0.7 confidence"). Revocable, never absent. The
   agent's job is to be a *legible partisan*, not a fake referee.
   Mediation is a role humans take; the system refuses to let an agent
   hold the mediator seat.

2. **Authority as leasehold, not property.** Sections have a *steward*
   (signs off, humans-only) and *contributors* (can edit, may include
   agents). Agent-authored paragraphs are literally uncommitted until a
   human steward "adopts" them. Inverts the current AI-tooling default:
   instead of agents shipping work that humans rubber-stamp, agents ship
   *proposals* that need human adoption to become text.

3. **A decision ledger (intent, not keystrokes).** Append-only artifact
   attached to spans: *{who proposed, who objected, who adopted, what
   alternative was killed, confidence}*. Agents write to the ledger under
   the same schema as humans. Forces agents to externalize hidden
   reasoning; lets future readers ask "what did Nova push against that we
   overrode?" The ledger is the doc's *shadow* — the real artifact of the
   collaboration. Prior art: Engelbart's NLS journal, per-span.

4. **A silence budget.** Tireless agents will colonize deliberation time.
   While a human is typing or recently typed, the orchestrator accrues
   "quiet credits" agents cannot spend. Agents may speak only when credits
   exceed a threshold *and* no human has typed for N seconds. Visible as a
   slim gauge. Variant: humans *spend* credits to summon an agent.
   Silence becomes an economic resource the team controls.

5. **The dissent primitive.** A **standing objection** attaches a
   dissenter's name and reasoning to a specific decision and travels with
   the doc forever. Shipping a PRD with "Maya standing-objects to the
   pricing model, see ledger #47" is a mature form of consensus, not a
   failure state. Borrowed from Quaker practice and IETF rough-consensus.
   Without it, group-doc "agreement" can't be distinguished from exhaustion.

## Lens 3 — Engineering (what's shippable now)

**Through-line:** the codebase is closer than it looks. The orchestrator is
already per-client, `AgentCursors` already renders an array, the schema is
permissive. The hard part is choosing what *not* to build first.

1. **Today's code ALMOST supports multi-human.**
   [`agent-cursor.ts:81`](../../src/agent-cursor.ts) stores cursors in an
   `AgentCursorState[]` with name + color + pos + thought. Swap the name
   for a userId and it renders humans. The ProseMirror decorations are
   name-agnostic.

2. **1-week MVP: spectator → live streaming → co-editor.**
   - **Day 1 (✅ shipped):** `?view=1` makes the editor read-only and
     skips orchestrator creation. See
     [App.tsx `isViewMode`](../../src/App.tsx) and PR #206.
   - **Days 2-3:** Add Supabase Realtime subscription in view mode so the
     observer sees live doc + chat updates (no server change; use existing
     Postgres realtime on the `documents` table).
   - **Days 4-5:** Render observer presence back to the author — one human
     cursor → N human cursors in `AgentCursors`.
   - **Days 6-7:** "Share read-only link" button in the session header;
     telemetry.

3. **CRDT is a separate track.** The existing multi-human plan already
   specifies Hocuspocus + Y.js. That's the right long-term transport but
   is ~500 LOC of server work. Do not couple it to the spectator MVP —
   read-mostly two-human collab works fine on last-write-wins.

4. **Orchestrator coordination under multi-human load.** Today each client
   runs its own orchestrator ([`useOrchestrator.ts:144`](../../src/hooks/useOrchestrator.ts)).
   With N humans this means N parallel orchestrators reacting to the same
   doc. Two options:
   - Per-doc global lock in Supabase (`sessions.lock_holder`,
     `lock_expires_at`). ~130 LOC, surgical.
   - Move the orchestrator to the Hocuspocus server. Cleaner, bigger lift.
   MVP can defer by only letting the *author's* client run an orchestrator
   while observers are read-only (matches the spectator shape).

5. **Lowest-risk next merge after the spectator MVP:** Supabase Realtime
   subscription in `loadDocument`. One new function in `session-store.ts`,
   wired in `App.tsx` only for `isViewMode`. No schema change, no server,
   no orchestrator impact.

---

## Where the lenses agree

- **Humans in the text; agents in the margin.** Designer's Margin Rail and
  thought-leader's leasehold authority both enforce a spatial/permission
  asymmetry. Engineering note: `agent-cursor.ts` already supports
  off-text thought bubbles.
- **Intent > keystrokes.** The decision ledger (lens 2) and provenance
  ribbon (lens 1) solve different aspects of the same problem: version
  history is semantically empty. Both require capturing *why* at the time
  of the change, not reconstructing later.
- **Defend human tempo.** Typing force-field (lens 1), silence budget
  (lens 2), and per-client orchestrator pause (lens 3) are three
  implementations of the same idea: humans set the clock, agents adapt to
  it.
- **Disagreement must be first-class.** Claimed-reviewer cards (lens 1)
  and standing objections (lens 2) reject "consensus = silence" as a
  design default.

## Where the lenses conflict

- **Agent edit freedom.** The designer's typing force-field assumes agents
  can still edit *outside* the human radius. The thought-leader's
  leasehold says agents never commit text directly — only proposals. These
  are genuinely different product philosophies. A plausible resolution:
  leasehold is the default for "important" sections; freer editing for
  whiteboard/brainstorm sections.
- **Stance visibility.** Lens 2 wants agents to declare stance up front
  on every disagreement. Lens 1's volume dial at *Silent* directly
  contradicts this (silent agents don't broadcast stance).
  Resolution: stance is declared on *request*, always visible *in the
  decision ledger*, not always in the UI.

---

## Proposed next merges (in order)

1. **Live doc streaming into spectator view.** Supabase Realtime
   subscription on the `documents` table, wired when `isViewMode`.
   No new infra.

2. **Copy-view-link button in session header.** One-click produces
   `<current-url>?view=1`, toasts "Read-only link copied." Invites the
   multi-human flow into existence.

3. **Observer presence rendered back to the author.** Reuse
   `AgentCursors` to render a "Priya (viewing)" cursor in the author's
   doc. First visible proof that multi-human is real.

4. **Decision ledger stub.** A new table
   `decisions(id, session_id, paragraph_id, entry jsonb, created_at)`
   with a one-click "Why this change?" affordance on agent proposals.
   Ships empty; populates as people use it.

5. **CRDT migration.** Only after items 1-4 prove there's demand. Follow
   the existing [multi-human plan](../plans/2026-03-20-multi-human-plan.md).

## Open questions

- Who "owns" the team volume dial in an org where membership is fluid?
- Is the decision ledger readable as narrative ("the story of this
  decision") or only as structured data? Do we need a rendering layer?
- Does the silence budget need to be per-human, per-agent, or global
  per-doc? Probably global, but not certain.
- When an agent standing-objects (can it?), what weight does that carry?
  Our instinct is *none that's load-bearing* — agents don't get dissent
  privileges until they can be held accountable. Worth pressure-testing.
