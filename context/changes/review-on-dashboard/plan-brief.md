# Move the Review Session onto the Dashboard — Plan Brief

> Full plan: `context/changes/review-on-dashboard/plan.md`
> Research: `context/changes/review-on-dashboard/research.md`

## What & Why

The `/review` page holds only the one card you're recalling — it doesn't earn a separate route.
Move the sequential FSRS review session onto `/dashboard` (below the heatmap) and delete the
route. Pure relocation; no caching.

## Starting Point

`/review` is a server-rendered panel (`getDueQueue` + `getDailyGoal` → recall card + rating
buttons, wrapped in a celebration provider). It advances by `revalidatePath` after each rating.
The dashboard already fetches `getDailyGoal()` and already gets a `revalidatePath('/dashboard')`
from the rate action — so the advance mechanism already reaches the dashboard.

## Desired End State

Opening `/dashboard` shows the review session as a focused, prose-width panel below the heatmap.
Rating a card advances to the next due card and refreshes the dashboard stats that rating changed
(streak, due-today, state breakdown, …). `/review` is gone (redirects to `/dashboard`); the
"Review" nav tab is removed; confetti/goal-dialog still fire on the last card.

## Key Decisions Made

| Decision           | Choice                                                               | Why (1 sentence)                                                                    | Source   |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Caching scope      | None — keep `revalidatePath`                                         | RLS-vs-cache forces a service-role client + dropping RLS; not worth this slice      | Research |
| Architecture       | Server-rendered embed (not client island)                            | Reviews mutate many dashboard stats; a client island would leave them visibly stale | Plan     |
| Panel presentation | Prose width (max-w-2xl), no Card wrapper; empty state compact inline | Preserves the authored focused-session UX inside the full-width page                | Plan     |
| "Due today" card   | Drop the link, keep the card                                         | Review is on the same page now; the link would be self-referential                  | Plan     |
| `/review` redirect | 307 (`permanent: false`)                                             | A relocation that could revert; a 308 gets browser-cached                           | Plan     |

## Scope

**In scope:** embed the review panel on the dashboard; delete `/review` + redirect; remove nav
item; drop dead `revalidatePath('/review')`; resolve self-referential links; repoint 2 E2E specs.

**Out of scope:** ALL caching (`unstable_cache`/`'use cache'`/tags/service-role/RLS-vs-cache),
stats-section trim, over-fetch cleanup, any scheduling/data-read change, client queue state — all
S-11.

## Architecture / Approach

Add `getDueQueue()` to the dashboard's existing `Promise.all`; render the review panel (provider
wrapping both branches, dialog as sibling) below the heatmap card inside an `mx-auto max-w-2xl`
wrapper. Delete the route, add the redirect, clean up nav + links + the dead revalidate. The
celebration-survives-unmount structure (`lessons.md:119-124`) must be preserved verbatim.

## Phases at a Glance

| Phase                      | What it delivers                                                                | Key risk                                                                       |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Relocate + remove route | Review panel on the dashboard; `/review` deleted, redirected, nav/links cleaned | Breaking survives-unmount (celebration won't fire on last card); width tension |
| 2. Repoint E2E specs       | `review.spec.ts` + `card-to-note.spec.ts` target the dashboard panel            | Locator scoping to the panel region                                            |

**Prerequisites:** local Supabase stack for E2E; `pnpm exec next typegen` after the route delete.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- The survives-unmount provider structure must be carried over exactly — easy to break when
  re-nesting JSX into the dashboard.
- Width: a prose-width column inside the full-width dashboard reads as a centered band (accepted;
  operator will reposition later).
- Accepted perf cost: each rating recomputes the dashboard aggregates until S-11 adds targeted
  invalidation.

## Success Criteria (Summary)

- Review works end-to-end on `/dashboard` (rate → advance → stats refresh → last-card celebration).
- `/review` redirects to `/dashboard`; nav item gone; no dead route references.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, and the repointed E2E suite all pass.
