# Auto-Evaluator: Adaptive Document Scoring System

**Date:** 2026-03-20
**Status:** Brainstorm complete, ready for planning

## What We're Building

An intelligent evaluation system that:

1. **Reads the document** and infers what it's supposed to be (PRD, tech spec, blog post, legal brief, etc.)
2. **Generates a rubric** tailored to that document type with weighted criteria
3. **Scores the document** against the rubric, producing per-section inline annotations
4. **Incentivizes agents** to improve the score -- agents see the rubric and current scores, and their prompts push them to address low-scoring areas

The evaluator acts as a **separate judge** using a different model than the writing agents (e.g., Gemini Pro or Claude), so agents aren't grading their own work.

## Why This Approach

**Adaptive rubric over fixed templates:** A PRD needs "clear success metrics" and "well-defined user stories." A tech spec needs "error handling coverage" and "API contract completeness." A blog post needs "narrative flow" and "hook strength." A fixed rubric misses the point. The evaluator infers the doc type and generates criteria that actually matter.

**Inline annotations over sidebar gauge:** Scores are most useful when tied to the specific section they evaluate. "Your Risk Analysis section scores 4/10 -- missing quantified impact and mitigation timeline" is actionable. A global "72/100" is not. Inline scoring also lets users and agents see exactly where to improve.

**Separate judge model:** Agents writing with Gemini Flash shouldn't evaluate their own output with Gemini Flash. A separate model (Gemini Pro, Claude) provides independent assessment. This mirrors how real editorial processes work -- writers don't grade their own papers.

**Agent incentivization over passive scoring:** The evaluator isn't just for humans to read. Agents see the rubric and scores in their prompts. Low-scoring criteria become explicit targets. This creates a feedback loop: evaluate > agents see gaps > agents improve > re-evaluate.

## Key Decisions

1. **Score visibility is inline** -- annotations appear next to doc sections, like a teacher marking in the margins. Each annotation shows the criterion, score (1-10), and specific feedback.

2. **Separate judge model** -- evaluator uses a different model than writing agents. Default to Gemini Pro. Configurable in settings for power users.

3. **Rubric is auto-generated then editable** -- evaluator infers doc type and generates 5-8 criteria with weights. User can adjust weights, add/remove criteria, or override the doc type classification.

4. **Evaluation triggers** -- runs automatically when:
   - Session enters Review phase
   - User explicitly requests it (button in toolbar)
   - Periodically during Drafting phase (every ~5 agent edits, debounced)

5. **Agent integration** -- when scores are available, agent prompts include:
   - The full rubric with current scores
   - The 2-3 lowest-scoring criteria highlighted
   - Instruction to prioritize improving low scores
   - The specific inline feedback for their area of expertise

6. **Score persistence** -- scores stored in a `document_scores` table linked to session, with history for tracking improvement over time.

## Rubric Generation

The evaluator prompt receives:
- Document content (full text)
- Document metadata (title, template type if selected)
- Session phase
- Active agent specialties

And produces:

```json
{
  "doc_type": "product-requirements-document",
  "doc_type_confidence": 0.92,
  "rubric": [
    {
      "id": "problem-clarity",
      "name": "Problem Definition Clarity",
      "description": "Is the problem well-defined with specific user pain points and quantified impact?",
      "weight": 0.15,
      "applies_to_sections": ["Problem Statement", "Background"]
    },
    {
      "id": "success-metrics",
      "name": "Success Metrics",
      "description": "Are success criteria measurable, time-bound, and tied to business outcomes?",
      "weight": 0.12,
      "applies_to_sections": ["Success Metrics", "Goals"]
    },
    {
      "id": "technical-feasibility",
      "name": "Technical Feasibility",
      "description": "Are technical constraints acknowledged and implementation approach realistic?",
      "weight": 0.10,
      "applies_to_sections": ["Technical Approach", "Architecture"]
    }
  ]
}
```

## Scoring Output

Per-section evaluation:

```json
{
  "overall_score": 6.4,
  "criteria_scores": [
    {
      "criterion_id": "problem-clarity",
      "score": 8,
      "section": "Problem Statement",
      "annotation": "Strong problem framing with user quotes. Could improve by quantifying the cost of the current workaround.",
      "position": { "heading": "Problem Statement", "type": "section-end" }
    },
    {
      "criterion_id": "success-metrics",
      "score": 3,
      "section": "Success Metrics",
      "annotation": "Metrics are vague ('improve retention'). Need specific targets: percentage, timeframe, measurement method.",
      "position": { "heading": "Success Metrics", "type": "section-end" }
    }
  ],
  "top_improvements": [
    "Add quantified success metrics with specific targets and measurement methods",
    "Include risk mitigation strategies with owners and timelines",
    "Define scope boundaries -- what is explicitly NOT in scope"
  ]
}
```

## Agent Prompt Integration

When scores exist, the agent prompt includes a new block:

```
## Document Evaluation (from independent judge)

Overall score: 6.4/10

Lowest-scoring areas:
- Success Metrics (3/10): "Metrics are vague. Need specific targets."
- Risk Analysis (4/10): "Missing quantified impact and mitigation timeline."
- Scope Definition (5/10): "No explicit out-of-scope section."

Your priority: Address the lowest-scoring criteria relevant to your expertise.
If you're about to make an edit, check if it improves a low-scoring criterion.
```

This makes agents self-directing toward document quality improvement without explicit user instruction.

## Inline Annotation UX

Annotations render as:
- A subtle colored bar in the right margin next to the section
- Color: green (8-10), yellow (5-7), red (1-4)
- Hover/click to expand: shows criterion name, score, and specific feedback
- Clickable "Fix this" button that triggers the most relevant agent to address it

The annotations are **Tiptap decorations** (similar to agent cursors), not persisted in the document HTML. They overlay the content without modifying it.

## Architecture

```
Document Content
  |
  v
Evaluator (separate model - Gemini Pro / Claude)
  |
  ├─ Infer doc type + generate rubric
  |     (cached per session, regenerated on doc type change)
  |
  ├─ Score each criterion against relevant sections
  |     (runs on trigger: phase change, user request, periodic)
  |
  ├─ Produce inline annotations with positions
  |     (mapped to Tiptap heading positions)
  |
  v
Two outputs:
  |
  ├─ UI: Tiptap decorations (inline score annotations)
  |     - Color-coded margin bars
  |     - Expandable feedback cards
  |     - "Fix this" agent trigger buttons
  |
  └─ Agent prompts: Rubric + scores injected into buildPrompt()
        - Lowest criteria highlighted
        - Agents prioritize improvements
        - Creates feedback loop
```

## Open Questions

1. **Evaluation frequency** -- how often during Drafting? Every 5 agent edits? Every 2 minutes? Too frequent = noisy + expensive. Too rare = stale scores.

2. **Score history visualization** -- show improvement over time as a sparkline? Or just current scores?

3. **User rubric editing** -- full rubric editor or just weight sliders? How much control?

4. **Multi-human evaluator** -- in multiplayer, do all users see the same scores? Can different users have different rubric priorities?

5. **Cost management** -- separate judge model means extra API calls. Should evaluation be opt-in for cost-sensitive users?

6. **"Fix this" routing** -- when user clicks "Fix this" on a low score, which agent gets the task? Route by specialty match (Lex for compliance scores, Nova for user story scores)?

## Scope

- Auto-detect doc type and generate rubric
- Score against rubric with per-section annotations
- Inline Tiptap decorations with color-coded margins
- Expandable feedback cards on hover/click
- "Fix this" button routing to relevant agent
- Agent prompt injection with rubric + scores
- Score persistence and history
- Separate judge model (Gemini Pro default)
- Evaluation triggers (phase change, manual, periodic)
- Editable rubric weights
