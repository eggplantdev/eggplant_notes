---
change_id: review-on-dashboard
title: Move the review session onto the dashboard (S1 bite of S-11 caching)
status: preparing
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Move the sequential FSRS review session off its own `/review` route and onto `/dashboard`,
deleting the route. Decided to fold in the **first bite of S-11** (tag-based caching) on the
review + dashboard read paths, because embedding a server-rendered review means advancing a
card re-renders the whole dashboard route — so the heavy aggregate reads must be cached or they
recompute on every rating.

**Chosen size: S1** (of S0 pure-move / S1 unstable_cache / S2 full Cache Components):

- Review session moves onto `/dashboard` as a panel **below the heatmap** (operator will
  reposition later). Stays **server-rendered** — preserve the "rate → revalidate → next card"
  model, no client queue state. Keep `ReviewCelebrationProvider` (confetti + goal dialog).
- `/review` route deleted, redirected to `/dashboard` (mirrors existing `/` → `/dashboard`).
- Nav "Review" item removed; "Due today" `StatCard` stops deep-linking to `/review` (in-page now).
- `getDueQueue` → `unstable_cache`, tag `review-${userId}`.
- `getDashboardData` → `unstable_cache`, tag `dashboard-${userId}` + a time `revalidate` floor.
- `rateTopicCheck` → drop `revalidatePath('/review')` + `revalidatePath('/dashboard')`, replace
  with `revalidateTag('review-${userId}')` only → aggregates stay cached on advance (cheap).
  Other mutators (note/subject/goal) invalidate `dashboard-${userId}`.
- **No `cacheComponents` flag flip** (that's S2 / full S-11). Using `unstable_cache` keeps the
  blast radius small and avoids the repo-wide Suspense refactor; S-11 later swaps it for
  `'use cache'`.

**Accepted trade-off:** the heavy stats panel shows slightly stale numbers _during_ a review
session (refreshes on next nav / time-revalidate). Operator OK with this; the planned stats
trim may reduce the surface anyway. Flag in docs.

**Open blocker for /10x-research + /10x-plan:** `unstable_cache` can't read cookies, but both
reads build an RLS client from the auth cookie. Resolve: pass `userId` as an explicit arg +
keep an RLS-scoped client, vs. a filtered service-role client (drops the RLS guardrail — avoid
unless forced). This is the exact blocker S-11 documented (`roadmap.md` S-11 Unknowns), now hit
early on two reads.

**Out of scope (stays S-11):** stats-section trim, full `cacheComponents` migration,
notes/subjects read caching, over-fetch cleanup.
