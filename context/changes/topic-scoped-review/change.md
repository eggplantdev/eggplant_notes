---
change_id: topic-scoped-review
title: Topic-scoped review on the memory-cards page
status: implemented
created: 2026-06-08
updated: 2026-06-09
archived_at: null
---

## Notes

Sibling of S-17 (topic-checks-listing): S-17 shipped topic-scoped _listing_; this ships topic-scoped _review_. Mount the existing `ReviewPanel` on the `/memory-cards` page, between the filter row and the card list, so the user reviews the soonest-due card matching whatever filters are active (subjects, search, state, maturity) — not the global queue.

Approved design (brainstorm 2026-06-08):

1. **Data layer** — extract a shared `applyCardFilters(query, opts)` helper from `getMemoryCardsList`'s inline `filtered()` closure; reuse it in `getDueQueue`, which gains the same `opts` ({ subjectIds, q, states, maturity, excludeId }) while keeping its `due_at <= now()` + `limit(1)` + `count` shape. Dashboard calls it with no opts (global, unchanged). Update the one internal caller (`rate-memory-card.ts:78`). No schema change — `memory_cards.subject_id` already exists.
2. **Page** — `memory-cards/page.tsx`: add `getDueQueue(filters)` + `getDailyGoal()` to the existing `Promise.all`; render `<ReviewPanel card={dueCard} goal={dailyGoal} />` inside a `<TitledCard title="Review">` between the filter `<div>` and the list. Subtitle is the "filters apply" explanation (e.g. "Reviewing due cards that match your filters · N due"). `ReviewPanel` reused verbatim (`provideCelebration` defaults true — advances in place like the dashboard).
3. **Advance** — add `revalidatePath('/memory-cards')` to `rateMemoryCard`; rating uses in-place mode (`returnNextDue = false`), so the page re-runs with current searchParams and pulls the next match. `excludeId` still blocks an "Again"-rescheduled card from re-surfacing.
4. **Edge cases** — empty deck (`total === 0 && !isFiltered`): hide the panel. Filtered-to-zero: `CaughtUpNotice`. Panel is pagination-independent (separate single-card query).

Decision: ALL filters (incl. state + search `q`) constrain the review queue uniformly, not just subject — matches the "respecting chosen filters" intent; subtitle says "match your filters", not "this subject".

Reuse anchors: `getMemoryCardsList` / `getDueQueue` (`src/features/memory-cards/queries.ts`), `ReviewPanel` (`src/features/review/components/review-panel.tsx`), `rateMemoryCard` (`src/features/review/actions/rate-memory-card.ts`), existing filter UI already on `memory-cards/page.tsx`.
