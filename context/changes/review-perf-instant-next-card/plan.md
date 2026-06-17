# Instant Next Review Card — Implementation Plan

## Overview

After rating a memory card the next card appears far too slowly on every review surface. We make it instant by warming the next card with Next's **router prefetch** (which caches the already-server-rendered RSC payload — Shiki code highlighting included), advancing **optimistically**, and removing the nuclear `revalidatePath('/', 'layout')` from the rating path. Shipped in three independently-verifiable phases, easy → hard.

## Current State Analysis

Three surfaces let a user rate cards, all sharing `ReviewPanel` (`src/features/review/components/review-panel.tsx`), `RatingButtons` (`.../rating-buttons.tsx`), and the `rateMemoryCard` Server Action (`src/features/review/actions/rate-memory-card.ts`):

- **`/dashboard`** (`src/app/(protected)/dashboard/page.tsx`) — in-place panel, advances via `revalidatePath('/', 'layout')`. Each rating re-runs the dashboard's counts RPC + stats RPC + goal + due queue.
- **`/memory-cards`** (`src/app/(protected)/memory-cards/page.tsx:38-51,100-111`) — in-place, **topic-scoped** panel (honors `subjects/q/state/maturity` filters via `getDueQueue(opts)`). Each rating re-runs **all 5** page queries including the whole-deck `getCardOverview()` RPC and the paginated `getMemoryCardsList()`, then re-streams the entire page just to swap one prompt. This is the worst offender.
- **`/memory-cards/[id]`** (`.../[id]/page.tsx`) — queue walk. Serial chain per rating: `rateMemoryCard` awaits the RPC, **then** awaits `getDueQueue({excludeId})` for `nextDueId` (`rate-memory-card.ts:75-76`), returns, `CardReviewQueue` `router.push`es to the next id (`card-review-queue.tsx:18-19`), and the new page re-fetches `getMemoryCardForReview` + `getDailyGoal` + `getSubjects` from scratch. `revalidatePath('/', 'layout')` **also** runs here unnecessarily (it always runs, `rate-memory-card.ts:72`) and would invalidate any prefetch.

### Key Discoveries:

- **Markdown is server-only.** `RenderMarkdown` uses `MarkdownAsync` + Shiki (`src/components/markdown/render-markdown.tsx:9-12`) — async, server-rendered. A client-side buffer of raw card rows can't render prompts without shipping Shiki to the browser or losing highlighting. **Router prefetch is the correct primitive** — it caches the server-rendered RSC for a route, Shiki markup and all.
- **Celebration survival is load-bearing** (`context/foundation/lessons.md:141-147`). The goal-crossing dialog state must live _above_ whatever advance mechanism unmounts the rating island. The `/memory-cards/[id]` route already hoists `ReviewCelebrationProvider` into its **layout** (`.../[id]/layout.tsx`), which Next preserves across `[id]→[id']` navigation, so `celebrate()` called from an unmounting `RatingButtons` still lands on the live provider. The dashboard self-provides (it advances in place today).
- **`revalidatePath` fights `router.prefetch`.** A Server Action that revalidates a path invalidates prefetched entries for it. So prefetch + the existing nuclear revalidate cancel out — the revalidate must be removed from the queue-walk path for prefetch to pay off.
- **`getDueQueue` already returns the soonest-due card + exact count in one round-trip** (`src/features/memory-cards/queries.ts:64-88`, `.limit(1)`), and takes `excludeId` + the shared `CardFilterOptsT` filters. The render-time "next due" id is the same id the action recomputes after rating (the just-rated card is excluded either way), so the client can own it and the action's post-rating `getDueQueue` becomes redundant.
- **Per-user aggregate caching is owned by roadmap S-11** (`data-fetching-efficiency`; `context/changes/perf-audit-2026-06-10/STATUS.md` M1, `roadmap.md:269-286`). Routing review off `/dashboard` and `/memory-cards` already removes those aggregates from the per-rating hot path, so this change does **not** add `'use cache'`/`cacheTag`.
- **Prefetch warms the _whole_ destination RSC**, so `getDailyGoal` + `getSubjects` re-fetched per `[id]` navigation are already covered — no separate query optimization needed.

## Desired End State

Rating a card shows the next card with no perceptible delay on all three surfaces. On the card route the next card is already warm (prefetched) and the swap is optimistic (the RPC runs in the background). The dashboard and `/memory-cards` send the user into that fast focused walk via a **Review →** CTA, and no rating triggers a full-page `revalidatePath('/', 'layout')` anymore.

Verify: walk a multi-card due queue and observe each next card paints instantly with no spinner; rate the last card and confirm the caught-up notice + (if the goal is crossed) the celebration dialog still appear; from `/memory-cards` with a subject filter active, confirm the walk only serves cards matching that filter.

## What We're NOT Doing

- **No `'use cache'` / `cacheTag` on `getCardOverview` or dashboard stat RPCs** — that's roadmap S-11.
- **No client-side markdown rendering / Shiki on the client** — prefetch keeps markdown server-side.
- **No data-model, schema, or `record_review` RPC changes.**
- **No removal of `framer-motion`** (won't-do, `AGENTS.md` / perf-audit H1/H2).
- **No change to FSRS scheduling** (`scheduling.ts`) or rating semantics.
- **No two-cards-ahead prefetch** — one card ahead, chained.

## Implementation Approach

Phase 1 makes the focused card route (`/memory-cards/[id]`) instant in isolation: prefetch the next card, let the client own the next id, strip the prefetch-killing revalidate, advance optimistically. Phases 2 and 3 then point the heavy in-place surfaces _into_ that fast route via a navigation CTA instead of re-rendering themselves — Phase 2 for the unfiltered dashboard (easy), Phase 3 for the filter-scoped `/memory-cards` (threads filters through the URL so topic-scoped review survives).

## Critical Implementation Details

- **Celebration + optimistic advance ordering.** On the card route, navigate optimistically using the **render-time** next-due id (passed as a prop), and fire `rateMemoryCard` without blocking the navigation. The `[id]` **layout** provider keeps `celebrate()` working even though it's called after the navigation has unmounted the triggering `RatingButtons` — do not move the provider into the page. When the soonest-due id is `undefined` (last card), do not navigate: swap to the caught-up notice in place, exactly as today.
- **Error reconciliation under optimistic advance.** If the background `rateMemoryCard` rejects/returns `{success:false}`, the rating never persisted, so the card remains due and re-surfaces later in the walk. Surface the failure with a toast (we've already navigated away — there is no card to revert in place). This is the one behavior change from today's inline-error-on-the-same-card model and is acceptable.
- **Filter threading (Phase 3).** The queue walk entered from `/memory-cards` must stay scoped to the active filters. Carry them as URL search params on `/memory-cards/[id]`, and have that page's `getMemoryCardForReview`-adjacent next-due computation + prefetch pass the parsed filters into `getDueQueue` (which already accepts `CardFilterOptsT`). Reuse the existing `parseCardFilters` (`src/features/memory-cards/utils.ts`).

---

## Phase 1: Card page instant (`/memory-cards/[id]`)

### Overview

Prefetch the next due card, let the client own the next id, remove the nuclear revalidate from the queue-walk path, advance optimistically, and drop the blocking loader.

### Changes Required:

#### 1. Compute & pass the next-due id at render

**File**: `src/app/(protected)/memory-cards/[id]/page.tsx`

**Intent**: So the client can prefetch and optimistically navigate without waiting for the action, compute the soonest-due card id (excluding the current one) when the page renders and hand it to the queue walker.

**Contract**: Add a `getDueQueue({ excludeId: id })` call to the page's existing `Promise.all` (`page.tsx:21-25`); pass `nextDueId = first?.id` into `<CardReviewQueue nextDueId={...}>`.

#### 2. Prefetch the next route + own the id in the queue walker

**File**: `src/features/review/components/card-review-queue.tsx`

**Intent**: Warm the next card's RSC while the user reads/answers, and advance using the render-time id instead of one returned by the action.

**Contract**: Accept a `nextDueId?: string` prop. On mount, if present, `router.prefetch('/memory-cards/${nextDueId}')`. Expose `advance()` (via the existing `QueueAdvanceProvider`) that pushes to the prefetched id or sets caught-up when absent. The advance callback no longer needs an id argument from the caller — it uses the prop.

#### 3. Optimistic advance + drop the blocking loader

**File**: `src/features/review/components/rating-buttons.tsx`

**Intent**: Make the next card paint immediately: navigate on click, run the rating in the background, celebrate on resolve, toast on failure. Remove the page-centered overlay on the queue-walk path.

**Contract**: On click: if a queue `advance` is present and there is a next id, call `advance()` immediately (optimistic nav) and fire `rateMemoryCard(memoryCardId, grade, goal)` without awaiting before navigation; on resolve, `celebrate(result.celebrate)` if present; on failure, toast the error. Remove the `<LoadingOverlay />` render and the `isAdvancing` blocking state on this path (keep inline `FormError` for the no-advance / dashboard-less case). The `returnNextDue` argument is dropped (see change 4).

#### 4. Stop the action from killing the prefetch & doing the redundant query

**File**: `src/features/review/actions/rate-memory-card.ts`

**Intent**: The nuclear `revalidatePath('/', 'layout')` invalidates the warmed prefetch and the post-rating `getDueQueue` duplicates work the client already has. Remove both from the queue-walk path.

**Contract**: Remove the `returnNextDue` parameter and the trailing `getDueQueue(...)` (`rate-memory-card.ts:74-77`); return `{ success, celebrate }`. Remove the unconditional `revalidatePath('/', 'layout')` (`rate-memory-card.ts:72`) — Phase 2/3 will make the heavy surfaces refresh on their own navigation, and the queue walk advances by `router.push`. Update `RateResultT` (`src/features/review/types.ts`) to drop `nextDueId`.

> Note: this removes the only `revalidatePath` from the rating action. The dashboard/`memory-cards` in-place panels still exist until Phase 2/3 — they will simply no longer auto-advance on rating in the interim. Because Phase 1 changes `RatingButtons` itself, confirm the in-place panels still rate without error (they fall through to the no-`advance` branch); their stale-after-rating display is resolved when Phases 2/3 convert them to CTAs. If that interim staleness is unacceptable, sequence Phase 2 immediately after Phase 1.

### Success Criteria:

#### Automated Verification:

- `next typegen` then `pnpm typecheck` passes (route + prop signature changes).
- `pnpm lint` passes.
- Unit specs pass: `pnpm test`.
- Existing review E2E passes: `pnpm test:e2e` (the queue-walk + caught-up + celebration spec referenced in `lessons.md:147`).

#### Manual Verification:

- Walking a ≥3-card due queue on `/memory-cards/[id]`, each next card paints instantly with no page-centered spinner.
- Rating the last due card shows the caught-up notice with the URL pinned (in-place swap, no nav).
- Crossing the daily goal still shows the celebration dialog.
- A forced failed rating (e.g. offline) shows an error toast and the card is still due on reload.

**Implementation Note**: After Phase 1 automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2 + 3: Heavy in-place surfaces (`/dashboard`, `/memory-cards`) — APPROACH UNDECIDED

> **Hard constraint (user, 2026-06-17): the in-place review panel stays on both surfaces. Do NOT remove `ReviewPanel` or replace it with a navigation-only CTA.** The earlier "Review → CTA" design is rejected.

### Why these are deferred

Making in-place rating _instant_ fights Shiki: the next card's prompt is server-rendered (`MarkdownAsync`), so an in-place swap needs either a `revalidate` (the slow thing we're removing) or a navigation. Keeping the panel AND making it instant is the unsolved tension. We are **deliberately deferring the approach decision until Phase 1 ships** and the user has felt the target walk speed — that's the right moment to judge how the dashboard/listing panels should advance.

### Candidate approaches (decide after Phase 1, keep the panel either way)

- **Keep panel, navigate-to-walk on advance.** The first card is rated in the in-place panel; advancing `router.push`es into the fast `/memory-cards/[id]` walk (subsequent cards on the route). Kills the nuclear revalidate; panel stays. Catch: a goal-crossing on that first in-place card must _stay put_ to show the celebration (the panel self-provides on the dashboard), matching the existing "goal-crossing stays put" rule — extra branch.
- **Keep panel in-place, scope the revalidate.** Stop re-running all 5 queries by isolating the due-card render into its own cached segment/island so only the panel re-renders. Preserves full in-place UX. Cost: route-level `revalidatePath` can't target one query — needs a parallel-route / segment-cache restructure, and Shiki still forces a server render per advance (faster, not instant).
- **`/memory-cards` filter scope** must be preserved by whichever approach wins (the panel is topic-scoped via `getDueQueue(opts)` today).

### Status

Approach selection is its own decision; do not implement Phase 2/3 from this section until the user picks one. Phase 1 is independent and unblocked.

---

## Testing Strategy

### Unit Tests:

- `rate-memory-card` returns `{ success, celebrate }` and no longer performs a post-rating due lookup (assert via the injected client mock that `getDueQueue` isn't called on the rating path).
- Filter-href serialization helper (Phase 3) round-trips `subjects/q/state/maturity` correctly.

### Integration / E2E Tests:

- Queue walk: rate across ≥2 due cards, assert URL card-id changes (advance) then caught-up with URL pinned (in-place swap) — the `lessons.md:147` regression guard, kept green.
- Goal-crossing celebration survives the optimistic advance.
- Phase 3: filter-scoped walk serves only matching cards.

### Manual Testing Steps:

1. Seed several due cards (`supabase db reset` → `dev@example.com`), open `/memory-cards/[id]`, rate quickly, confirm instant next card and no spinner.
2. Rate down to zero; confirm caught-up + celebration.
3. From `/dashboard`, click Review; confirm fast walk.
4. From `/memory-cards` with a filter, click Review; confirm scoped, instant walk.

## Performance Considerations

- The win is **perceived latency**: prefetch moves the next card's server render off the critical path (it happens while the user reads), and optimistic advance removes the RPC from the critical path. No additional DB load — same queries, executed earlier/in parallel rather than serially. One redundant `getDueQueue` per rating is removed.

## Migration Notes

- None — no schema or data migration. Behavior change only.

## References

- Change identity: `context/changes/review-perf-instant-next-card/change.md`
- Plan brief: `context/changes/review-perf-instant-next-card/plan-brief.md`
- Celebration-survival rule: `context/foundation/lessons.md:141-147`
- Aggregate-caching boundary: `context/changes/perf-audit-2026-06-10/STATUS.md` (M1 → S-11), `roadmap.md:269-286`
- Due query: `src/features/memory-cards/queries.ts:64-88`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Card page instant

#### Automated

- [x] 1.1 `next typegen` + `pnpm typecheck` passes — 313c96e
- [x] 1.2 `pnpm lint` passes — 313c96e
- [x] 1.3 `pnpm test` passes — 313c96e
- [ ] 1.4 `pnpm test:e2e memory-card-review-page.spec.ts` passes — fix verified by reasoning + first-run partial pass (3/3 other specs green; only the caught-up assertion failed on the race now fixed). Green-confirmation deferred: a parallel `next dev` was continuously corrupting the shared `.next/dev/types/validator.ts` (in tsconfig include), breaking every prod-build type-check. Re-run when no `next dev` is active.

#### Manual

- [ ] 1.5 ≥3-card walk paints each next card instantly, no spinner
- [ ] 1.6 Last card → caught-up notice, URL pinned
- [ ] 1.7 Goal crossing still shows celebration dialog
- [ ] 1.8 Failed rating → error toast, card still due on reload

### Phase 2 + 3: Heavy in-place surfaces — APPROACH UNDECIDED

- [ ] 2.0 (blocked) Pick the in-place-preserving approach after Phase 1 ships, then re-expand this section
