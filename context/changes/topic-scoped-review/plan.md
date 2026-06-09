# Topic-scoped review on the memory-cards page — Implementation Plan

## Overview

Add the spaced-repetition review loop to the `/memory-cards` page, between the filter row and the card list, scoped to whatever filters are active (subjects, search, state, maturity). Today review only exists on the dashboard against the **global** due queue; this lets the user drill into one subject (or any filter combination) and review just those due cards. Sibling of S-17, which shipped topic-scoped _listing_ — this ships topic-scoped _review_.

## Current State Analysis

- **Review lives only on the dashboard.** `dashboard/page.tsx:88` renders `<ReviewPanel card={card} goal={dailyGoal} />`; `card` comes from `getDueQueue()` (`memory-cards/queries.ts:26`), which selects the single soonest-due card globally (`due_at <= now()`, `order by due_at`, `limit(1)`, `count: 'exact'`). It takes **no filter parameters**.
- **The filter pattern already exists.** `getMemoryCardsList` (`memory-cards/queries.ts:64`) filters by `subjectIds`/`states`/`maturity`/`q` inside an inline `filtered(head)` closure (lines 80-102), using `.in('subject_id', …)`, `.in('state', …)`, a `stability` maturity clause, and `searchOr(...)`. The `/memory-cards` page (`memory-cards/page.tsx`) already parses these from `searchParams` and renders the full filter UI (`SearchFilterInput`, `SubjectFilter`, two `UrlMultiSelectFilter`s).
- **Advance is by `revalidatePath`, in place.** `RatingButtons` (`review/components/rating-buttons.tsx:17,30,37`) reads `useQueueAdvance()` — `undefined` when no provider is mounted (the dashboard case). With no advance fn, it calls `rateMemoryCard(id, grade, goal, false)` (returnNextDue=false) and the page re-renders via the action's `revalidatePath('/dashboard')`, pulling the next due card into the same panel. The standalone card page (`/memory-cards/[id]`) is the _other_ mode: it mounts a `QueueAdvanceProvider`, passes `returnNextDue=true`, and `router.push`es to `nextDueId`.
- **`rateMemoryCard`** (`review/actions/rate-memory-card.ts:72-74`) currently revalidates `/dashboard` and `/memory-cards/[id]` — **not** `/memory-cards`.
- **Celebration safety is already handled.** `ReviewPanel` (`review/components/review-panel.tsx:18,55`) defaults `provideCelebration=true`, wrapping **both** the card branch and the `CaughtUpNotice` branch in `ReviewCelebrationProvider` — the lessons.md:141-147 fix so the goal-hit dialog survives `revalidatePath` unmounting `RatingButtons`. The dashboard relies on this default; `/memory-cards` will too.
- **No schema change.** `memory_cards.subject_id` already exists (decouple migration `20260606161054`), indexed (`memory_cards_subject_id_idx`).

### Key Discoveries:

- `getMemoryCardsList`'s `filtered()` closure (`memory-cards/queries.ts:80-102`) is the exact filter logic `getDueQueue` needs — extract it once, reuse in both.
- `getDueQueue` is `limit(1)` at offset 0, so the 416 out-of-range pagination trap (lessons.md:156-161) does **not** apply — no `runPaginatedQuery` wrapper needed.
- No new route is added (mounting on the existing page), so the `next typegen` step (lessons.md:105-110) does not apply.
- `getDailyGoal` lives in `features/settings/queries` (imported in `dashboard/loader.ts:3`); the page must fetch it for `ReviewPanel`'s `goal` prop.
- `getDueQueue`'s current signature is `getDueQueue(client?, excludeId?)`; the only non-loader caller is `rate-memory-card.ts:78` (`getDueQueue(supabase, parsedId.data)`).

## Desired End State

On `/memory-cards`, with cards matching the active filters, a "Review" card sits between the filter row and the list. It shows the soonest-due card **among the filtered set**; rating it advances in place to the next filtered-due card (or `CaughtUpNotice` when none remain), exactly like the dashboard. With no filters, it reviews the whole due queue (same cards as the dashboard). The dashboard is byte-for-byte unchanged. Verify by filtering to a subject and confirming the reviewed card belongs to it, and that rating advances within the filter.

## What We're NOT Doing

- No new `/review` route and no dedicated review page — review mounts on the existing `/memory-cards` page.
- No schema/migration change.
- No change to the dashboard's review behavior or the standalone `/memory-cards/[id]` queue walk.
- No change to FSRS scheduling, the `record_review` RPC, or `applyRating`.
- No new filter UI — the page already renders all four filters; we only consume their parsed values.
- No persistence of "review scope" beyond the URL searchParams already in place.

## Implementation Approach

Two phases. **Phase 1** is internal and non-breaking: extract the shared filter builder, teach `getDueQueue` to accept the same filter opts, and add the `/memory-cards` revalidation to the rating action — the dashboard keeps calling `getDueQueue()` with no opts and behaves identically. **Phase 2** lights it up: the page fetches the filtered due card + daily goal and mounts `ReviewPanel`. Splitting this way means a query/action regression (Phase 1) surfaces independently of a page-wiring bug (Phase 2), and Phase 1 alone can't change any user-visible behavior.

## Critical Implementation Details

- **`getDueQueue` signature reshape.** Fold the filter opts and `excludeId` into a single optional `opts` object so the call sites read cleanly and the dashboard's no-arg call still works. The one existing caller (`rate-memory-card.ts:78`, currently `getDueQueue(supabase, parsedId.data)`) must move `excludeId` into `opts` and pass the client in its new position. This is the only behavioral coupling other phases depend on.
- **Panel render gate.** Render the Review `TitledCard` only when `total > 0` (cards match the current filters). When `total === 0` the page already shows its own `EmptyState` (no-deck or no-match) — adding a "caught up" panel there would be misleading. When `total > 0` but nothing is due, `ReviewPanel`'s built-in `CaughtUpNotice` branch shows (the approved "match dashboard" behavior).

## Phase 1: Data + action plumbing

### Overview

Extract the filter builder, make `getDueQueue` filter-aware, and revalidate `/memory-cards` on rating. No user-visible change; dashboard unaffected.

### Changes Required:

#### 1. Shared card-filter builder

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Extract the subject/state/maturity/search predicate logic currently inlined in `getMemoryCardsList`'s `filtered()` closure into one reusable helper, so `getDueQueue` applies identical filtering without duplicating it. Keep the comments explaining the maturity-from-stability derivation and the note-vs-card subject distinction.

**Contract**: A function that takes a PostgREST query builder + the filter opts (`subjectIds?: string[]`, `q?: string`, `states?: number[]`, `maturity?: MaturityT[]`) and returns the builder with `.in('subject_id', …)`, `.in('state', …)`, the single-bucket `stability` maturity clause, and the `searchOr(['prompt','example','code_context'], q)` `.or(...)` applied conditionally. `getMemoryCardsList`'s `filtered()` is refactored to call it; behavior identical (same predicates, same projection). Lives beside the queries (same file or a sibling per `feature-first-structure` — a pure helper, not a query itself).

#### 2. Filter-aware `getDueQueue`

**File**: `src/features/memory-cards/queries.ts`

**Intent**: Add an optional `opts` object so the soonest-due query can be scoped to the same filters as the listing, while preserving its hand-rolled row+count shape. The dashboard calls it with no opts (global, unchanged).

**Contract**: `getDueQueue(opts?: { subjectIds?: string[]; q?: string; states?: number[]; maturity?: MaturityT[]; excludeId?: string }, client?: SupabaseClient<Database>): Promise<{ first?: DueCardT; count: number }>`. Applies the shared filter builder, then `.lte('due_at', now)`, `.order('due_at', { ascending: true })`, `.limit(1)`, `count: 'exact'`; `excludeId` still maps to `.neq('id', excludeId)`. The `count` now reflects cards due **under the filters**.

#### 3. Update the rating action's caller + revalidation

**File**: `src/features/review/actions/rate-memory-card.ts`

**Intent**: Adapt the one `getDueQueue` call to the new signature and revalidate the `/memory-cards` path so the mounted panel advances in place after a rating (mirroring the existing `/dashboard` revalidation).

**Contract**: Line ~78 `getDueQueue(supabase, parsedId.data)` → `getDueQueue({ excludeId: parsedId.data }, supabase)`. Add `revalidatePath('/memory-cards')` alongside the existing `revalidatePath('/dashboard')` (line ~72). No change to `returnNextDue` semantics — the `/memory-cards` panel uses in-place mode (no `QueueAdvanceProvider`), same as the dashboard.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm exec eslint src/features/memory-cards/queries.ts src/features/review/actions/rate-memory-card.ts`
- Existing unit tests pass: `pnpm test`

#### Manual Verification:

- Dashboard review still works end-to-end (load `/dashboard`, rate a card, the next due card appears) — confirms the `getDueQueue()` no-opts path and the caller reshape didn't regress.
- The standalone `/memory-cards/[id]` queue walk still advances (rate → navigates to next due card).

**Implementation Note**: After Phase 1 automated verification passes, pause for manual confirmation that the dashboard + card-page review are unregressed before starting Phase 2.

---

## Phase 2: Page wiring

### Overview

Fetch the filtered due card + daily goal on `/memory-cards` and mount `ReviewPanel` between the filter row and the list.

### Changes Required:

#### 1. Mount the review panel on the memory-cards page

**File**: `src/app/(protected)/memory-cards/page.tsx`

**Intent**: Add the filtered due-card read and the daily goal to the existing parallel fetch, then render the review panel as a titled card whose subtitle explains the queue respects the active filters. Reuse `ReviewPanel` verbatim (default `provideCelebration` — advances in place like the dashboard).

**Contract**: Extend the existing `Promise.all` (currently `getSubjects()`, `getMemoryCardsList({…})`, `getCardOverview()`) with `getDueQueue({ subjectIds: selectedIds, q, states, maturity })` and `getDailyGoal()`. Render between the filter `<div>` (closes line 81) and the list block (line 83), gated on `total > 0`:

- `<TitledCard title="Review" subtitle={…}>` wrapping `<ReviewPanel card={dueCard} goal={dailyGoal} />`.
- Subtitle is the "filters apply" explanation, including the filtered due count from `getDueQueue`'s `count` (e.g. `isFiltered ? 'Reviewing due cards that match your filters' : 'Reviewing all due cards'`, plus `· N due` when count > 0). Reuse the existing `isFiltered` boolean (page line 41) and `pluralize`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm exec eslint "src/app/(protected)/memory-cards/page.tsx"`
- Build succeeds: `pnpm build`

#### Manual Verification:

- `/memory-cards` with no filters shows a Review panel whose card matches the dashboard's current due card.
- Filtering to a single subject scopes the Review panel to a card from that subject; the subtitle reflects the filter and the due count.
- Rating a card in the filtered panel advances in place to the next filtered-due card; when none remain, `CaughtUpNotice` shows (panel stays, list still renders).
- Crossing the daily goal while reviewing on `/memory-cards` shows the celebration dialog (provider survives the revalidate).
- A search/filter that matches **no** cards shows the list's normal empty state and **no** Review panel (gate `total > 0`).
- Combining filters (subject + state + search) scopes the due queue by all of them simultaneously.

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation of the above before wrap-up.

---

## Testing Strategy

### Unit Tests:

- The extracted filter builder is a thin PostgREST-builder wrapper (no pure branching logic worth isolating beyond what `getMemoryCardsList` already exercises) — no new unit test is high-value here. Per `test-plan.md` (risk-first), this slice's risk is the **query wiring + advance behavior**, best covered at the E2E layer.

### Integration / E2E Tests:

- **Deferred to a follow-up `/10x-e2e` pass** (matching the S-19 precedent of deferring dense E2E). The target spec: seed cards across two subjects with known due dates, filter `/memory-cards` to subject A, assert the reviewed card belongs to A, rate it, assert the next card is also from A (advance stays in-filter), and that an empty filtered queue shows `CaughtUpNotice` with the list still present. Author per the `/10x-e2e` quality rules (testid locators, wait-for-state).

### Manual Testing Steps:

1. `/dashboard` → rate a card → next due card appears (Phase 1 no-regression).
2. `/memory-cards` (no filter) → Review panel card == dashboard's due card.
3. Filter to subject A → Review panel scopes to A; subtitle + count correct.
4. Rate within the filter → advances to next A card; exhaust → `CaughtUpNotice`, list still shows.
5. Search matching nothing → list empty state, no Review panel.
6. Cross the daily goal mid-review on `/memory-cards` → celebration dialog appears.

## Performance Considerations

`getDueQueue(filters)` is one extra indexed `limit(1)` read added to the page's existing `Promise.all` (runs concurrently, no added latency tier). `getDailyGoal` is a small settings read, also concurrent. The `(user_id, due_at)` index backs the due filter; `subject_id` is separately indexed. No N+1, no new round-trip tiers.

## Migration Notes

None — no schema change. `memory_cards.subject_id` already exists and is indexed.

## References

- Change identity & approved design: `context/changes/topic-scoped-review/change.md`
- Sibling slice (topic-scoped listing): `context/archive/2026-06-05-topic-checks-listing/`
- Filter pattern to reuse: `src/features/memory-cards/queries.ts:64-111` (`getMemoryCardsList`)
- Due query to extend: `src/features/memory-cards/queries.ts:26-47` (`getDueQueue`)
- Panel reused verbatim: `src/features/review/components/review-panel.tsx`
- Advance + celebration safety: `context/foundation/lessons.md:141-147`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data + action plumbing

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 13cef6b
- [x] 1.2 Linting passes on queries.ts + rate-memory-card.ts — 13cef6b
- [x] 1.3 Existing unit tests pass: `pnpm test` — 13cef6b

#### Manual

- [ ] 1.4 Dashboard review unregressed (rate → next due card appears)
- [ ] 1.5 Standalone `/memory-cards/[id]` queue walk still advances

### Phase 2: Page wiring

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — 11f5e71
- [x] 2.2 Linting passes on memory-cards/page.tsx — 11f5e71
- [x] 2.3 Build succeeds: `pnpm build` — 11f5e71

#### Manual

- [ ] 2.4 No-filter panel card matches the dashboard's due card
- [ ] 2.5 Subject filter scopes the panel; subtitle + count correct
- [ ] 2.6 Rating advances in-filter; exhausting shows CaughtUpNotice, list still renders
- [ ] 2.7 Goal-crossing celebration dialog shows on `/memory-cards`
- [ ] 2.8 No-match search shows list empty state and no Review panel
- [ ] 2.9 Combined filters scope the due queue by all simultaneously
