# Contributing to Markup

Markup is a collaborative writing workspace where humans draft documents alongside AI agents. This doc covers how to get a dev environment running, the conventions we follow when changing code, and how PRs work.

## Getting started

```bash
nvm use              # .nvmrc pins Node 22.12.0
npm install
npm run dev          # Vite at http://localhost:5173
```

Required environment variables are documented in [CLAUDE.md](./CLAUDE.md). For local development you can point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at any Supabase project with the migrations in `supabase/migrations/` applied; the app runs localhost-auth-free by default.

## Commands you'll use

| Script | What it does |
|--------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run typecheck` | TypeScript only — fast, no bundle |
| `npm run build` | Typecheck + production bundle |
| `npm run test` | Vitest (single run) |
| `npm run lint` | ESLint over `src/`, `api/`, `server/` |

CI runs all four on every PR. Run `typecheck`, `test`, and `lint` before you push.

## Branches and PRs

- Branch off `main`. Name branches after the change, not the author — e.g. `a11y/task-checklist-expand`, `feat/agent-teams`, `fix/orchestrator-race`.
- PRs should be small and focused. A ~50-line change is easier to review than a 500-line one, even if you have to open five PRs.
- Open PRs as **ready for review**, not drafts, unless you actively want feedback on an unfinished idea.
- PRs auto-deploy a Vercel preview. CI includes Copilot, Devin, and Charlie review bots — they often catch real issues; take their feedback seriously.
- Squash-merge when you merge. Keeps the history readable.

## Code style

- **Prose in PR descriptions beats comments in code.** Default to no comments; add one only when *why* is non-obvious (hidden constraint, subtle invariant, workaround). Don't explain *what* — well-named identifiers do that.
- **No emojis in code or UI text.** (See AGENTS.md for the authoritative rule list.)
- **Trust the framework and internal callers.** Don't add error handling, fallbacks, or validation for scenarios that can't happen. Only validate at system boundaries (user input, external APIs).
- **One concern per PR.** Batched refactors are hard to review. A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper.
- **Follow existing patterns.** If the codebase uses `React.memo(fn)` for leaf components, do that. If hooks live in `src/hooks/`, put yours there. Match the neighbors.

## Testing

- Unit tests live in `src/__tests__/`.
- New utilities with any branching logic should come with tests.
- UI changes don't require tests but should be manually verified in the Vercel preview.
- If a test starts failing during your PR, fix the root cause. Don't relax assertions to make them pass.

## Design discussions

Larger design decisions live in `docs/brainstorms/` (exploratory) and `docs/plans/` (committed). If you're proposing a change that touches the agent loop, the data model, or the collaboration model, write a brainstorm first and link it from the PR.

## Security

- Never commit secrets. `.env` files are gitignored; use `vercel env add` for production.
- `api/gemini.ts` is the server-side proxy that holds the Gemini API key. The client must never reach the Gemini endpoint directly.
- The app enforces Supabase RLS. Don't weaken policies to ship a feature — extend them.

## Asking for help

- GitHub issues for bugs and concrete feature requests.
- Larger questions ("how should we think about X") belong in a brainstorm doc so the discussion has a durable home.
