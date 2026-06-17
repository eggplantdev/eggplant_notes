# Instant Next Review Card — Plan Brief

> Full plan: `context/changes/review-perf-instant-next-card/plan.md`

## What & Why

Rating a memory card makes the next card appear far too slowly on all three review surfaces. We make the next card instant by warming it with Next's router prefetch (which preserves server-rendered Shiki highlighting), advancing optimistically, and removing the nuclear `revalidatePath('/', 'layout')` that re-renders the whole page just to swap one prompt.

## Starting Point

Three surfaces (`/dashboard`, `/memory-cards`, `/memory-cards/[id]`) share one `ReviewPanel` + `rateMemoryCard` action. `/dashboard` and `/memory-cards` advance via `revalidatePath('/', 'layout')` (the latter re-runs all 5 page queries incl. the whole-deck overview RPC); `/memory-cards/[id]` walks the queue serially (rate → fetch next id → navigate → re-fetch) and _also_ fires the revalidate, which would invalidate any prefetch.

## Desired End State

Each next card paints with no perceptible delay. The card route is warm (prefetched) and advances optimistically with the RPC in the background; the dashboard and `/memory-cards` send the user into that fast focused walk via a **Review →** CTA. No rating triggers a full-page revalidate anymore. Caught-up notice and goal-crossing celebration still work; topic-scoped review on `/memory-cards` is preserved.

## Key Decisions Made

| Decision           | Choice                                         | Why                                                                                | Source |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| Prefetch primitive | Next `router.prefetch` of the next route       | Shiki/`MarkdownAsync` is server-only; a client card buffer would drop highlighting | Plan   |
| Phase ordering     | Card page first, then heavy surfaces           | Isolated, low-risk; proves the approach before the structural changes              | Plan   |
| Card-page advance  | Prefetch next + drop the queue-walk revalidate | Revalidate invalidates the prefetch; client owns the render-time next id           | Plan   |
| Heavy surfaces     | Route into the queue walk via a Review CTA     | One mechanism; decouples "show next card" from "refresh whole page"                | Plan   |
| Advance timing     | Optimistic, reconcile on error                 | Truly instant; RPC runs while the user reads the next prompt                       | Plan   |
| Prefetch depth     | One card ahead, chained                        | Matches the existing `limit(1)` due query; near-zero waste                         | Plan   |
| Aggregate caching  | Left to roadmap S-11                           | Routing review off those pages already removes them from the hot path              | Plan   |
| Loader             | Dropped on the optimistic path                 | Removes the exact perceived slowness reported; inline error kept                   | Plan   |

## Scope

**In scope:** prefetch + optimistic advance on `/memory-cards/[id]`; removing the rating-path revalidate + redundant due query; converting `/dashboard` and `/memory-cards` to a Review CTA into the walk; threading filters so the `/memory-cards` walk stays topic-scoped.

**Out of scope:** `'use cache'`/`cacheTag` on aggregates (S-11); client-side markdown/Shiki; schema, `record_review` RPC, or FSRS changes; `framer-motion` removal; two-cards-ahead prefetch.

## Architecture / Approach

Phase 1 makes the focused card route instant in isolation (prefetch the next card, client owns the next id, strip the prefetch-killing revalidate, advance optimistically, drop the blocking loader). Phases 2–3 then point the heavy in-place surfaces _into_ that route via a navigation CTA instead of re-rendering themselves — Phase 2 for the unfiltered dashboard, Phase 3 for filter-scoped `/memory-cards` (filters carried through the URL). Celebration stays handled by the `[id]` route layout provider, which survives navigation (`lessons.md:147`).

## Phases at a Glance

| Phase                 | What it delivers                                                         | Key risk                                                                   |
| --------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1. Card page instant  | Prefetched + optimistic queue walk on `/memory-cards/[id]`               | Optimistic-advance must keep the celebration dialog firing post-navigation |
| 2. Dashboard CTA      | `/dashboard` routes into the fast walk; no more nuclear revalidate there | Interim: in-place panels stale between P1 and P2                           |
| 3. Filter-scoped walk | `/memory-cards` Review CTA preserves topic-scoped review                 | Threading filters through the URL into the walk + prefetch                 |

**Prerequisites:** local Supabase stack up (`supabase start` / `db reset` for due-card seed). Phases are sequential (2 and 3 build on Phase 1's prefetch).
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- Optimistic advance changes error UX on the card route: a failed RPC surfaces as a toast and the unrated card re-surfaces later in the walk (no in-place revert, since we've navigated). Judged acceptable.
- Between Phase 1 and Phase 2 the in-place dashboard/`memory-cards` panels no longer auto-advance on rating (the revalidate is gone). Sequence Phase 2 promptly, or accept the interim staleness.
- Filter threading (Phase 3) assumes `getDueQueue`'s existing `CardFilterOptsT` fully expresses the listing's filters — it does today.

## Success Criteria (Summary)

- Each next card paints instantly with no spinner across all three surfaces.
- Caught-up notice + goal-crossing celebration still work after the optimistic/prefetched advance.
- Filtered review from `/memory-cards` serves only matching cards, instantly.
