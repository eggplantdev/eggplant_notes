---
date: 2026-06-05T12:48:47+0200
researcher: ex-Plant
git_commit: 8ad19730873ebb072bbfe499f99759920cf0416b
branch: main
repository: 10x_devs
topic: 'Move the review session onto the dashboard + first bite of S-11 tag-based caching (S1)'
tags: [research, codebase, review, dashboard, caching, unstable_cache, rls]
status: complete
last_updated: 2026-06-05
last_updated_by: ex-Plant
---

# Research: Move review onto dashboard + S1 tag-caching

**Date**: 2026-06-05T12:48:47+0200
**Researcher**: ex-Plant
**Git Commit**: 8ad19730873ebb072bbfe499f99759920cf0416b
**Branch**: main
**Repository**: 10x_devs

## Research Question

For the `review-on-dashboard` change (S1): (1) can the per-user Supabase reads be wrapped in
`unstable_cache` while preserving RLS, or does it force a service-role client? (2) what is the
complete mutation→invalidation surface for `review-${userId}` / `dashboard-${userId}` tags?
(3) what are the exact embed mechanics so the celebration-survives-unmount pattern is preserved?
(4) Next 16 route-delete / typegen / test-surface facts.

## Summary

**The headline finding overturns the cost basis for picking S1.** Option (a) from the S-11
plan — "keep an RLS-scoped anon client and just pass `userId` as an argument" — is **not
possible**. The anon client is RLS-scoped _only_ by the auth cookie (`createClient()` reads
`cookies()`); none of the reads carry an explicit `user_id` filter. `unstable_cache` cannot call
`cookies()`. Therefore the **only** way to cache any of these reads is option (b): a **new
service-role client** + an explicit `.eq('user_id', userId)` on every cached read — which
**drops RLS** as the guardrail on those paths and introduces a security surface the repo does not
have today (the service-role key isn't even imported into `src/lib/env.ts`).

This means **S1 is bigger and riskier than we sold it** (we chose it over S0/B partly because it
was "small, no service-role"). It is the exact S-11 blocker, now confirmed unavoidable for the
`unstable_cache` route. **Re-decision needed** — see Open Questions. The embed mechanics,
mutation map, and route/test facts below hold regardless of which caching path is chosen.

## Detailed Findings

### A. Data-access + the RLS/cookie wall (the blocker)

- `createClient()` builds the client **from the request cookie** with the **anon key** —
  `src/lib/supabase/server.ts:9-27` (`const cookieStore = await cookies()` at `:10`). RLS
  scoping is a property of the cookie-bound client, **not** of any `user_id` arg.
- `getCurrentUser = cache(async () => …)` — `src/lib/supabase/server.ts:33-39`. React
  per-request dedup (NOT cross-request). Callers: `(protected)/layout.tsx:10`,
  `dashboard/page.tsx:32`, `settings/actions/update-daily-goal.ts:17`. **Keep this** (roadmap).
- **No service-role / admin client exists** anywhere in `src/` or `supabase/`. `src/lib/env.ts`
  exposes only `SUPABASE_URL` + `SUPABASE_ANON_KEY`; `SUPABASE_SERVICE_ROLE_KEY` is never
  imported. S-05 delete-account (`features/account/actions/delete-account.ts:7-14`) deliberately
  uses a `SECURITY DEFINER` RPC on the cookie-bound anon client — **no service-role plumbing to
  reuse.**
- Every read follows `const supabase = client ?? (await createClient())` then a SELECT with **no
  `user_id` filter**, relying on RLS. The `client?` param is the Playwright-injection seam, not
  a caching seam (but it is a convenient seam — a cached wrapper could build a service-role
  client outside and pass it in).

Per-read verdict (can it run inside `unstable_cache`?):

| Read                      | file:line                        | (a) anon + userId arg, keep RLS? | (b) service-role + `.eq('user_id', userId)`? | Trap                                                                                                                                               |
| ------------------------- | -------------------------------- | -------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getDueQueue`             | `topic-checks/queries.ts:18-34`  | **No**                           | Yes                                          | selects `'*, notes(title)'`, `count:'exact'`, `.lte('due_at', now)` — `now` non-deterministic (cache-key issue)                                    |
| `getDashboardData`        | `dashboard/data.ts:19-42`        | **No**                           | only if all 6 sub-reads do                   | composes 6 reads via `Promise.all` (`:20-27`); `computeDashboardStats` is **pure**                                                                 |
| `getChecksForStats`       | `topic-checks/queries.ts:41-46`  | No                               | Yes                                          | —                                                                                                                                                  |
| `getDailyGoal`            | `settings/queries.ts:11-19`      | **No**                           | Yes                                          | `.maybeSingle()` is correct **only** under RLS; under service-role MUST add `.eq('user_id', userId)` or it breaks across users — **sharpest trap** |
| `getReviewedTodayCount`   | `review-events/queries.ts:57-64` | **No**                           | Yes                                          | `.gte('reviewed_at', now−2d)` non-deterministic                                                                                                    |
| `getReviewsThisWeekCount` | `review-events/queries.ts:72-80` | **No**                           | Yes                                          | `.gte('reviewed_at', now−8d)` non-deterministic                                                                                                    |

Caching `getDashboardData` as a unit also pulls in `getNotesForStats` (`notes/queries.ts`),
`getSubjects` (`subjects/queries.ts`), `getRecentRatings` + `getReviewActivity`
(`review-events/queries.ts`) — all face the same wall.

**Non-determinism caveat:** `now`/`since` flow into the SQL. As cache-key args they bust the
cache constantly; if frozen they go stale. A day-bucket key strategy is needed or these don't
cache usefully.

### B. Mutation → invalidation surface (for the two tags)

`record_review` RPC (`supabase/migrations/20260603131542_fsrs_review_loop.sql:48-80`): UPDATE
`topic_checks` (FSRS state) then INSERT `review_events`. `create_note_with_checks`
(`…180614…sql:16-44`): INSERT `notes` + N `topic_checks`. `delete_account` (`…092554…sql`):
DELETE `auth.users` → cascades all owned rows.

Actions that must bust **`dashboard-${userId}`** (dirty aggregates): `rateTopicCheck`,
`createTopicCheck`, `deleteTopicCheck`, `createNote`, `deleteNote`, `updateDailyGoal`,
`createSubject`, `deleteSubject`, `deleteAccount`.
Actions that must bust **`review-${userId}`** (shift the due queue): `rateTopicCheck`,
`createTopicCheck`, `deleteTopicCheck`, `createNote` (if checks), `deleteNote`.
Neither: `updateNote` (unless subject changes — borderline), `updateTopicCheck` (metadata only),
`reorderNote`, `updateSubject`, all auth actions.

**Gap worth noting:** today `createTopicCheck`/`deleteTopicCheck` revalidate only `/notes/[id]`,
**not** `/dashboard` — so creating/deleting cards already doesn't refresh dashboard aggregates.
Tag-based invalidation is an opportunity to fix that, but it widens scope beyond review.
Full per-action table in the agent notes (20 actions audited).

### C. Embed mechanics (preserve celebration-survives-unmount)

- `review/page.tsx:19-89`: fetches `[{first: card, count}, goal]` via
  `Promise.all([getDueQueue(), getDailyGoal()])` (`:20`), computes `previews` server-side
  (`:22-30`), wraps **both** branches in `<ReviewCelebrationProvider>` (`:38-86`). Branch
  (`:39`): `!card` → "All caught up 🎉" card with a `Link href="/dashboard"` (`:49`, becomes
  self-referential on the dashboard) **:** recall card (`:55-81`) + `<RatingButtons … />` (`:83`).
- `RatingButtons` (`features/review/rating-buttons.tsx`): `'use client'`; props
  `{topicCheckId, previews, goal}`; calls `rateTopicCheck(topicCheckId, grade, goal)` via
  `useActionTransition`, then `if (result.success && result.celebrate) celebrate(result.celebrate)`;
  consumes `useReviewCelebration()`.
- **The load-bearing constraint** (`review-celebration-context.tsx:14-17`, lesson
  `lessons.md:119-124`): the provider owns `celebration` state and renders
  `<GoalCelebrationDialog>` as a **sibling outside `{children}`**, so when rating the last card
  flips `card`→undefined and **unmounts `RatingButtons`**, the dialog survives. On the dashboard
  the provider must wrap **both** branches of the review panel, with the dialog as a provider
  sibling — NOT nested in the recall branch.
- `getDueQueue(client?)` returns `{ first?: DueCardT; count }`; `DueCardT = TopicCheckT &
{ notes: { title } | null }` (`topic-checks/types.ts:10`) — exposes `id`, `prompt`, `example`,
  `code_context`, `note_id`, `notes?.title` in one round-trip.
- **Insertion point:** dashboard heatmap card is `dashboard/page.tsx:85-92`; insert the review
  panel **immediately after `:92`**, before the "Featured" grid at `:94`.
- **Width tension:** review is authored for `PageShell width="prose"` (max-w-2xl); dashboard
  uses default `width="full"` (max-w-120rem). `PageShell.width` is **page-level**
  (`page-shell.tsx:39-43,84`), can't scope a section → the panel needs its **own** inline
  `mx-auto w-full max-w-2xl` wrapper (or a `w-full` `Card` like the heatmap).
- **Free data:** `getDailyGoal()` already runs on the dashboard (`:33`); only `getDueQueue()` +
  the `previewIntervals`/`formatInterval` mapping is a new fetch to add to the page's
  `Promise.all`.

### D. Next 16 route-delete / typegen / test facts

- **No caching APIs in use today** — zero hits for `unstable_cache` / `'use cache'` / `cacheTag`
  / `revalidateTag` / `cacheLife` in `src/`. This change introduces caching for the first time.
- `next.config.ts`: `distDir` + one redirect `'/' → '/dashboard' (permanent)`. **`cacheComponents`
  NOT set.** Mirror the redirect for `'/review' → '/dashboard'`.
- **Typed routes ON.** After deleting `review/page.tsx` run **`pnpm exec next typegen` before
  `pnpm typecheck`/`build`** (lesson `lessons.md:105-110`). Scripts: `typecheck: "tsc --noEmit"`,
  `build: "next build"`, `test:e2e: "playwright test"`.
- **E2E to refactor (navigate `/review` directly):** `e2e/review.spec.ts` (`:28`, `:88-89` —
  full-loop + RLS-isolation), `e2e/card-to-note.spec.ts` (`:20`). Repoint to `/dashboard` + locate
  the panel. `e2e/dashboard.spec.ts` references review _status text_ only — likely fine.
- **Unit tests unaffected** (logic, not routes): `goal-crossing`, `review-scheduling`,
  `dashboard-streak`, `dashboard-heatmap-matrix`, `daily-goal`, `week-count`.
- `revalidatePath('/review')` (`rate-topic-check.ts:74`) → **delete** after route removal;
  `revalidatePath('/dashboard')` (`:75`) is **already present** so the post-rate advance works
  on the dashboard even before any tag work (relevant to the S0 fallback).
- Self-referential links to resolve: "Due today" `StatCard` `Link href="/review"`
  (`dashboard/page.tsx:96-101`); "All caught up" `Link href="/dashboard"` (`review/page.tsx:49`).

## Code References

- `src/lib/supabase/server.ts:9-27,33-39` — cookie-bound anon `createClient`, `getCurrentUser` cache()
- `src/lib/env.ts:21-22` — only URL + anon key exposed (no service-role)
- `src/features/topic-checks/queries.ts:18-34,41-46` — `getDueQueue`, `getChecksForStats`
- `src/features/dashboard/data.ts:19-42` — `getDashboardData` (6-read composite)
- `src/features/settings/queries.ts:11-19` — `getDailyGoal` (`.maybeSingle()` RLS-dependent)
- `src/features/review-events/queries.ts:57-64,72-80` — today/week counts (non-deterministic `since`)
- `src/features/review/actions/rate-topic-check.ts:74-75` — the two `revalidatePath` calls
- `src/app/(protected)/review/page.tsx:19-89` — the panel to relocate
- `src/features/review/review-celebration-context.tsx:14-32` — survives-unmount provider
- `src/app/(protected)/dashboard/page.tsx:85-92` — heatmap card; insert panel after `:92`
- `src/components/layout/page-shell.tsx:39-43,84` — page-level width (can't scope a section)
- `src/components/app-nav/nav-items.ts:7` — `/review` nav entry to remove
- `next.config.ts:9-17` — redirect pattern to mirror

## Architecture Insights

- The repo's entire data layer is **RLS-via-cookie with zero explicit `user_id` filters**. Any
  cross-request cache (`unstable_cache` or `'use cache'`) is fundamentally incompatible with that
  model — caching forces a switch to explicit-filter + elevated client on the cached paths.
- The post-rate "advance" works on the dashboard **out of the box** today because the action
  already calls `revalidatePath('/dashboard')`. The _only_ reason to add caching is to stop that
  revalidation from recomputing the heavy aggregates — which is precisely the read set blocked by
  the RLS wall.
- **Client-island advance (approach B) sidesteps the blocker entirely:** if the review panel
  advances in the browser without a route revalidation, the dashboard aggregates never recompute,
  so nothing needs caching, no service-role client, RLS stays intact everywhere. Cost: client
  queue state + a `rateTopicCheck` variant that returns the next card without revalidating.

## Historical Context (from prior changes)

- `roadmap.md` S-11 (`data-fetching-efficiency`) Unknowns — already named the RLS-vs-`'use cache'`
  cookie ban as the gating blocker and proposed option (a)/(b); this research **confirms (a) is
  impossible**, so (b) (service-role + explicit filter, "avoid unless forced") is forced for the
  `unstable_cache` path.
- `lessons.md:119-124` — celebration state must live above the revalidation-toggled branch.
- `lessons.md:105-110` — `next typegen` after route add/move/delete.
- `lessons.md:84-89` — DB-id validation `z.guid()` not `z.uuid()` (touches `rateTopicCheck`).

## Open Questions

1. **S1 vs B re-decision (BLOCKING the plan).** S1 (`unstable_cache`) is confirmed to require a
   new service-role client + `.eq('user_id', userId)` on every cached read, dropping RLS on those
   paths. That is materially more security surface than the basis on which S1 was chosen over
   approach B. Approach **B (client-island advance)** now needs _no_ caching and _no_ service-role
   client and keeps RLS intact — at the cost of client queue state + a non-revalidating rate
   variant. Decision needed before `/10x-plan`.
2. If S1 proceeds: the day-bucket cache-key strategy for the non-deterministic `now`/`since`
   reads, and whether to cache `getDashboardData` as a unit (threading `userId` through all 6
   sub-reads) or per-read.
3. If tag invalidation is adopted, whether to also fix the pre-existing gap (create/delete
   topic-check not refreshing the dashboard) now or leave it to S-11 (scope creep risk).
