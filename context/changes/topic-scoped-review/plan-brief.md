# Topic-scoped review on the memory-cards page — Plan Brief

> Full plan: `context/changes/topic-scoped-review/plan.md`

## What & Why

Add the spaced-repetition review loop to the `/memory-cards` page, scoped to the active filters (subject, search, state, maturity), so the user can review just one topic's due cards instead of the global queue. Today review only exists on the dashboard against all due cards. This is the natural sibling of S-17 (topic-scoped _listing_) → topic-scoped _review_.

## Starting Point

`/memory-cards` already renders all four filters and a filtered, paginated list (`getMemoryCardsList`). Review lives only on the dashboard, where `ReviewPanel` consumes `getDueQueue()` — the soonest-due card globally, no filter params. `memory_cards.subject_id` already exists and is indexed.

## Desired End State

On `/memory-cards`, a "Review" card sits between the filter row and the list, showing the soonest-due card among the filtered set. Rating advances in place to the next filtered-due card (or "All caught up" when none remain), identical to the dashboard's mechanic. No filter → reviews the whole due queue. Dashboard and the standalone `/memory-cards/[id]` queue walk are unchanged.

## Key Decisions Made

| Decision     | Choice                                                                       | Why (1 sentence)                                                                               | Source     |
| ------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| Entry point  | Mount on existing `/memory-cards` page, between filters and list             | Page already has all filter UI + parsed params; no new route, no new filter UI                 | Brainstorm |
| Selection    | All filters constrain the queue (not just subject)                           | Matches the "respect chosen filters" intent and the listing's behavior                         | Brainstorm |
| Empty state  | Always show panel + `CaughtUpNotice` (match dashboard)                       | Simplest, zero new copy, consistent with the dashboard                                         | Plan       |
| Panel gate   | Render only when `total > 0` (cards match filters)                           | A zero-match search shows its normal empty state, not a misleading "caught up"                 | Plan       |
| Advance      | In-place via `revalidatePath('/memory-cards')`, `returnNextDue=false`        | No `QueueAdvanceProvider` mounted → `RatingButtons` auto-uses in-place mode like the dashboard | Plan       |
| Filter reuse | Extract `applyCardFilters` from `getMemoryCardsList`, reuse in `getDueQueue` | One predicate source for list + due queue, no duplication                                      | Plan       |
| Schema       | No change                                                                    | `memory_cards.subject_id` already exists + indexed                                             | Plan       |

## Scope

**In scope:** filter-aware `getDueQueue`; shared `applyCardFilters` helper; `revalidatePath('/memory-cards')` in `rateMemoryCard`; mount `ReviewPanel` + daily-goal fetch on the page.

**Out of scope:** new route/page; schema change; dashboard or `[id]` queue-walk behavior; FSRS/`record_review` changes; new filter UI; persisting scope beyond URL params.

## Architecture / Approach

`getDueQueue(opts?, client?)` gains the same filter opts as the listing, applying a shared `applyCardFilters` predicate then `due_at<=now()`+`limit(1)`+`count`. The page adds `getDueQueue(filters)` + `getDailyGoal()` to its existing `Promise.all` and renders `ReviewPanel` (reused verbatim, default `provideCelebration`) inside a `TitledCard`. Rating revalidates `/memory-cards`, re-running the server component with the current searchParams → next filtered-due card.

## Phases at a Glance

| Phase                     | What it delivers                                                                                      | Key risk                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Data + action plumbing | Filter-aware `getDueQueue` + shared filter helper + `/memory-cards` revalidation; dashboard untouched | Signature reshape must not regress the dashboard's no-arg call or the `[id]` caller               |
| 2. Page wiring            | `ReviewPanel` mounted on `/memory-cards`, scoped to filters                                           | Celebration-provider survival across revalidate (already handled by `provideCelebration` default) |

**Prerequisites:** none — all touchpoints exist; no migration.
**Estimated effort:** ~1 session, 2 small phases.

## Open Risks & Assumptions

- Assumes `ReviewPanel`'s default `provideCelebration=true` wrapping both branches keeps the goal-hit dialog alive across `revalidatePath` on `/memory-cards` (same as dashboard — lessons.md:141-147). Verified by manual step 2.7.
- E2E is deferred to a follow-up `/10x-e2e` pass (S-19 precedent); Phase gates rely on manual verification + typecheck/lint/build.

## Success Criteria (Summary)

- Filtering `/memory-cards` to a subject scopes the Review panel to that subject's due cards; rating advances within the filter.
- No-filter review on `/memory-cards` matches the dashboard's due card; dashboard itself is unchanged.
- Exhausting a filtered queue shows "All caught up" while the list still renders; a zero-match search shows no panel.
