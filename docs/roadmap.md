# markup.so roadmap

Last updated: 2026-04-11
Launch target: 2026-05-23

## Goal

Ship a public document workspace where visible named agents collaborate in front of the user, fast enough and polished enough that a cold visitor immediately understands the thesis and stays to watch.

## Current truth

- The site is live and fast enough to demo today.
- The product has gained real task visibility and preset flow work on `main`, all landed on 2026-04-06.
- The remaining risk is not lack of features. It is demo trust: empty inserts, Gemini output recovery, and cold-start dead time can still make the product feel broken.
- The public-facing README is still from the Collab era, which blurs the launch story.

## Priority order

### P0: Remove demo-breaking moments

- Fix the empty-insert bug so an agent never appears to take a turn and do nothing.
- Consolidate Gemini response normalization so malformed output shapes are handled in one place and tested.
- Keep live performance healthy; any regression to slow or broken first paint becomes immediate priority.

### P1: Improve the first 10 seconds

- Land a warmed-demo plan that starts a visitor inside visible motion instead of behind the 7-second rate limiter.
- Turn that plan into the smallest viable implementation that shows checklist progress, partial document state, and an imminent next action.
- Make sure at least Aiden and Nova each complete a meaningful visible turn during a one-minute demo drive.

### P2: Tighten the public story

- Replace the stale README/rebrand language with the actual markup thesis.
- Keep visual language aligned with chat: same personas, same colors, same animated blob presence.
- Defer any broader refactor unless it clearly improves the public demo.

## Out of scope before launch

- New personas, paid plans, or a third product surface.
- A shared design-system extraction unless both products are otherwise launch-ready.
- Any cleanup work that does not improve reliability, speed, or the visible-agent experience.

## This week's success criteria

- The top markup blocker is explicit and executable.
- The warmed-demo path moves from vague aspiration to a written plan.
- README and roadmap tell the same story instead of the old Collab story.
