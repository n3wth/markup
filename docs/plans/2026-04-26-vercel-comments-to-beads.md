# Vercel Toolbar comments → beads bridge

Source: bead mk-7ms (2026-04-26)

## Goal

When Oliver leaves an inline comment on the deployed markup.so via the Vercel
Toolbar, that comment becomes a bead routed to the markup rig agents. The
comment text plus the URL/coordinates ride along as context. When the work is
done, the comment thread is resolved.

## Status (2026-04-26)

- ✅ **Toolbar mounting** — `@vercel/toolbar` is installed and conditionally
  mounted via `src/lib/VercelToolbarMount.tsx` for `user.email ===
  oliver@newth.ai`. Mounted at the `main.tsx` provider level so it covers app,
  marketing, legal, and login routes.
- ❌ **Comments → bead automation** — blocked. Vercel does not currently
  expose a public webhook or REST endpoint for preview/production comments.
  Confirmed via the Vercel Comments docs and the open community request at
  https://community.vercel.com/t/how-to-access-vercel-preview-comments-via-api-or-webhooks-for-automation/36485.
  The only built-in automation is the manual *Convert to Issue* button that
  pushes a comment thread into Linear, Jira, or GitHub.

## Proposed bridge architecture (when an API exists)

```
Oliver leaves comment
        │
        ▼
Vercel Comments service ── webhook ──▶  /api/vercel-comments  (Vercel function)
                                              │ verify x-vercel-signature
                                              │ filter to oliver@newth.ai
                                              ▼
                                        Beads ingress (HTTP)
                                              │
                                              ▼
                                       bd create  →  markup rig
```

Each new Oliver-authored comment becomes a bead with:

- **Title:** first ~80 chars of comment text
- **Type:** `bug` if the comment contains words like "broken", "missing",
  "wrong"; otherwise `task`
- **Description:** full comment text + URL + DOM selector / pixel coords +
  thread permalink, so the agent can re-open the page and see what Oliver was
  pointing at
- **Source attribute:** `vercel-comment:<thread-id>` so we can resolve the
  thread once the bead is closed

When the bead closes, post a reply on the comment thread (also via the missing
API) and mark it resolved.

## Workarounds while the API is unavailable

Two pragmatic options:

1. **Linear-as-bridge.** Install the Vercel Linear integration and have Oliver
   click "Convert to Issue" on each comment. Then a Linear webhook (Linear
   *does* have webhooks) fires `/api/linear-issue-created`, which detects the
   `Vercel: n3wth/markup` label and forwards to bd. Cost: one manual click per
   comment, but everything after is automatic.
2. **Local poller.** Run a small script on Oliver's machine that polls the
   undocumented Vercel Comments endpoint that the toolbar UI itself uses
   (cookies-authenticated). When new comments by Oliver appear, run `bd create`
   directly. Cost: brittle (relies on undocumented API), but zero manual steps.

Recommendation: option 1. Manual click is fine for a one-person feedback loop
and we don't depend on undocumented internals.

## Follow-up work

A separate bead tracks the bridge implementation. See `bd show` for the
current ID; this doc is the design reference it points at.
