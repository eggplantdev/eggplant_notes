---
change_id: review-on-dashboard
title: Move the review session onto the dashboard (pure relocation, S0)
status: implemented
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Move the sequential FSRS review session off its own `/review` route and onto `/dashboard`,
deleting the route. **Pure relocation (S0) — NO caching.**

**Decision (2026-06-05):** `/10x-research` confirmed the S-11 blocker is unavoidable for the
`unstable_cache` path — option (a) "keep the RLS anon client, pass `userId`" is impossible (the
anon client is RLS-scoped only by the cookie; no read carries an explicit `user_id` filter), so
caching would force a brand-new service-role client + hand-added `.eq('user_id', userId)` on
every cached read, dropping RLS as the guardrail. Not worth it for this slice. **Operator's
call: nuke the route, keep `revalidatePath` for now, deal with caching separately in S-11.**

Scope:

- Review session moves onto `/dashboard` as a panel **below the activity-heatmap card**
  (`dashboard/page.tsx:85-92`; insert after `:92`). Operator will reposition later.
- Stays **server-rendered** — keep the "rate → `revalidatePath('/dashboard')` → next card"
  model, no client queue state. The action **already** calls `revalidatePath('/dashboard')`
  (`rate-topic-check.ts:75`), so the post-rate advance works on the dashboard out of the box.
- `/review` route deleted; add a redirect `'/review' → '/dashboard'` in `next.config.ts`
  (mirror the existing `'/' → '/dashboard'`). Run `pnpm exec next typegen` before typecheck.
- Drop the now-dead `revalidatePath('/review')` (`rate-topic-check.ts:74`); keep `:75`.
- Nav "Review" item removed (`nav-items.ts:7`).
- Resolve self-referential links: "Due today" `StatCard` `Link href="/review"`
  (`dashboard/page.tsx:96-101`) and "All caught up" `Link href="/dashboard"`
  (`review/page.tsx:49`).
- **Celebration-survives-unmount (load-bearing, lessons.md:119-124):** `ReviewCelebrationProvider`
  must wrap **both** branches of the embedded panel with `<GoalCelebrationDialog>` as a provider
  sibling, so rating the last card (→ `card` undefined → `RatingButtons` unmounts on
  revalidation) keeps the dialog mounted.
- **Width:** review is authored for `PageShell width="prose"`; dashboard is `width="full"`.
  `PageShell.width` is page-level, so the panel needs its own inline `mx-auto w-full max-w-2xl`
  wrapper (or a `w-full` Card like the heatmap).
- **Data:** `getDailyGoal()` already runs on the dashboard; only `getDueQueue()` + the
  `previewIntervals`/`formatInterval` mapping is a new fetch to add to the page `Promise.all`.

**Tests:** repoint `e2e/review.spec.ts` (`:28`, `:88-89`) and `e2e/card-to-note.spec.ts` (`:20`)
from `/review` → `/dashboard` + locate the panel. Unit tests unaffected (logic, not routes).

**Out of scope (stays S-11):** ALL caching (`unstable_cache`/`'use cache'`/tags), service-role
client, RLS-vs-cache resolution, stats-section trim, notes/subjects read caching, over-fetch
cleanup. The felt sluggishness of recomputing aggregates on each advance rides until S-11.
