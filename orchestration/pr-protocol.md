# PR protocol

Every agent-authored PR in this push MUST follow this protocol. Reviewer rejects non-compliant PRs.

## Branch naming

`<wave>/<task-id>-<slug>`

Examples:
- `w0/W0-T001-extract-turn-queue`
- `w1/W1-T014-project-model-migration`
- `w2/W2-T007-persona-memory-store`

## Commit message

Conventional-ish, terse. Match the repo's existing style (see `git log --oneline -30`).

```
<type>: <imperative summary under 70 chars> (<task-id>)

<optional body, only if non-obvious>
```

Types: `feat`, `fix`, `refactor`, `perf`, `a11y`, `chore`, `docs`, `test`.

No `Co-Authored-By:` tag required; orchestrator decides whether to attribute.

## PR description template

```markdown
## What
<1-3 bullets, what changed>

## Why
<link to task-id, reference to wave PRD acceptance criterion>

## Acceptance
- [ ] <criterion 1 from task spec>
- [ ] <criterion 2>

## Verification
<what the author ran locally — build / lint / test output summary>

## Risk
<low / medium / high + why>

## Task
`<task-id>` in `orchestration/queue.json`
```

## Scope rules

- **One task per PR.** If you find a second issue, open a follow-up task in `queue.json`, don't bundle.
- **No scope creep.** If the task says "extract X," don't also rename Y.
- **No cosmetic drive-bys.** No whitespace changes, no unrelated imports, no "while I'm here" edits.
- **Typed if TypeScript.** No `any` unless the existing call site forces it. Prefer narrowing.
- **Tests where the repo has a pattern for them.** Don't fabricate test infra; use `src/__tests__/` when a test file is natural.

## CI gate (hard)

A PR cannot merge until `.github/workflows/ci.yml` passes on the PR branch. The workflow runs:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

If CI is red, reviewer sends PR back to author with CI log. Author fixes or closes.

## Reviewer rubric

Reviewer loads the PR diff + the surrounding files + the task spec + the wave PRD. Grades on:

1. **Scope fidelity** — does the PR do exactly what the task said and nothing more?
2. **Correctness** — does it work? Reviewer mentally executes the change.
3. **Pattern fit** — does it follow existing conventions in the repo?
4. **Safety** — any regression risk in adjacent code? Any untested hot path newly affected?
5. **Readability** — will this code make sense to a human in 6 months?
6. **Acceptance criteria** — are all checkboxes in the PR body actually met by the diff?

Reviewer outputs one of:

- **APPROVE** — orchestrator merges
- **REQUEST_CHANGES** — with specific line-anchored comments; orchestrator sends back to author with reviewer notes
- **REJECT** — fundamental problem; task goes back to `pending` with revised spec

## Merge policy

- **Squash merge** (repo convention from recent PRs)
- Orchestrator (or Oliver) clicks merge only when: CI green + reviewer APPROVE + no conflicts with main
- After merge: orchestrator appends `PR_MERGED` to `state.md`, moves task to `merged` in `queue.json`, deletes branch
- If merge conflicts: orchestrator sends PR back to author to rebase; author never force-pushes main

## Halt conditions enforced per-PR

- Task has been retried 3+ times → halt, escalate to Oliver
- PR sits in review > 24h → reviewer re-dispatched with fresh context
- PR CI red > 3 consecutive pushes by author → halt, escalate

## Labels (optional, use if repo supports)

- `wave:0`, `wave:1`, `wave:2`, `wave:3`, `wave:4`
- `track:foundation`, `track:product`, `track:agent`, `track:openness`, `track:launch`
- `agent:author:<runner-id>`, `agent:reviewer:<runner-id>`
