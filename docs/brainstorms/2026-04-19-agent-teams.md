# Agent Teams — Making Four Individuals Feel Like a Crew

**Date:** 2026-04-19
**Status:** brainstorm
**Code seed:** [`src/lib/agent-teams.ts`](../../src/lib/agent-teams.ts)

## The observation

Today Markup has four agents — Aiden, Nova, Lex, Mira — and each runs
independently. The existing `HomeDashboard` "Full Team" starter bundles
all four into a doc, but they still behave as four parallel individuals.
There is no shared context, no role hierarchy, no notion of *"we are
reviewing this together."*

This matters because users start asking the same question once they've
lived with the product for a week: **"Which of you should I ask?"** And
the only answer the current design can give is "whichever one you
@-mention" — which pushes coordination onto the human.

## The shift

A **team** is a named group of agents with a **shared mission context**
prepended to each member's persona. The mission context is what makes
three agents feel like *a team* rather than three overlapping solo acts.

Concretely (this PR ships the seed):

```
teamContext: "You are part of the Launch Review team. Your collective
goal is to make the document ship-ready in the next 72 hours.
Prioritize concrete gaps over theoretical concerns. Defer to your
teammates on their domains..."
```

The team context is static, not dynamic — it's a declarative prompt
modification, not an orchestrator behavior change. That keeps it cheap
to iterate: new teams are data, not code.

## Shipped in this PR

`TEAM_PRESETS` with five starter teams:

1. **Launch Review** (Aiden + Nova + Mira) — ship-readiness sweep
2. **Compliance Review** (Lex + Aiden) — legal gate for external share
3. **Design Crit** (Mira + Nova) — user-first challenge
4. **Architecture Review** (Aiden + Lex) — systems and constraints
5. **Full Review** (all four) — the board meeting

Plus a pure `resolveTeam(teamId)` function that expands a team into
concrete `AgentConfig[]` with persona = `${teamContext}\n\n${persona}`.

## Not shipped (follow-ups)

**UI wiring.** The module is unused until a follow-up PR adds a "Start a
team" affordance to `HomeDashboard` or a "Load a team" chip in
`AgentConfigurator`. Shipping the module first lets the UI surface the
same data structure from multiple entry points (home, command palette,
existing-session flow).

**Dynamic team context.** Right now `teamContext` is a static string.
The interesting future shape is *team context as a live document that
the team negotiates* — e.g., the team collectively adjusts "our
priority this session is speed over completeness" at the top of a
chat, and that updates every member's effective prompt. This is where
the "team volume dial" from `2026-04-19-multi-entity-collab-design-lenses.md`
lands as a concrete feature.

**Team-level roles.** Leads, seconds, silent observers. The `Lex leads;
Aiden supports` framing in today's Compliance Review teamContext is the
proto-role hierarchy. A proper implementation would be a field per
member: `role: 'lead' | 'second' | 'observer'`, with orchestrator
behaviors to match (observer agents don't take turns unless summoned).

**Per-doc team memory.** A team should remember what it decided last
time it reviewed *this kind of doc*. Separate from user preferences;
scoped to the team. Interesting because teams could build reputations
and patterns over time — "the Launch Review team has a thing about
testing edge cases in the second round."

## Where teams meet multi-human

In the multi-entity brainstorm we talked about **leasehold authority** —
agents propose, humans adopt. Teams are the natural aggregation layer:
a human says "I want the Launch Review team's take" and gets one
coherent output with three voices and clear domain ownership, not three
disjoint comment threads.

And when multiple humans are in a doc, a team is a *shared handle* —
"Priya pinged the Compliance Review team" reads as a team action, not
four separate agent pings. That's the UX win that makes multi-human +
multi-agent legible rather than chaotic.

## Open questions

- Should teams be discoverable/shareable across users, or per-workspace?
  Probably per-workspace with a "Copy to my library" affordance.
- When a team is active, is every member in-doc by default, or can a
  subset of the team be "on call"? Inclined toward the latter — a
  four-person team with two observers behaves very differently from
  four equally-loud agents.
- How does adding a custom agent interact with the preset teams? When
  I drag @Ivy (a custom agent) into a Launch Review, does she inherit
  the team context? Inclined toward yes, with an opt-out flag on the
  agent.
- Do teams get their own avatar/identity in the UI, or are they just
  labels? A named-team chip (like `Launch Review`) in the header
  that replaces the stack of individual agent avatars when a team is
  active feels right.
