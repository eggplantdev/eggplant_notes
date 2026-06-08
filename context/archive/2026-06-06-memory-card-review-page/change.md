---
change_id: memory-card-review-page
title: Standalone memory-card page with on-demand review buttons
status: archived
created: 2026-06-06
updated: 2026-06-08
archived_at: 2026-06-08T07:40:50Z
---

## Notes

Add a standalone card detail page at `/memory-cards/[id]` that the listing links to (replacing the current note-deep-link / edit-page branching; per-row Edit button stays). The page reuses the dashboard's review experience — prompt → `<details>` answer → `RatingButtons` with predicted intervals — so the user can review any card they pick, not just the one the due-queue hands them ("review outside the algorithm").

Decisions from brainstorming (2026-06-06):

- **Real review**, not practice: reuse the existing `rateMemoryCard(cardId, grade, goal)` action. It already works on any card by id regardless of due date — updates FSRS schedule, logs `review_events`, counts toward the goal.
- **Stay on the card** after rating: page refreshes showing the new schedule. Requires `rateMemoryCard` to also `revalidatePath` the card route (currently only revalidates `/dashboard` — additive, safe for dashboard).
- New query `getMemoryCard(id)` shaped like `getDueQueue` but fetched by id (full row for FSRS previews + embedded `notes(title)` / `subjects(title)`); RLS-scoped, `notFound()` on miss.
- Source-note link (`/notes/[noteId]#card-[id]`) shown only when `note_id` is set.
- Reuse `ReviewPanel`; extract its card-rendering core if it carries dashboard-only copy (no dashboard behavior change).
- New public surface → per-slice review gate + E2E spec (list → open card → reveal → rate → schedule advances).

## Revision (2026-06-08) — queue walk instead of stay-on-card

The "Stay on the card after rating" decision above was **reversed** during the review gate. The standalone page now **advances through the due queue**: a non-goal rating navigates to the next due card (`router.push('/memory-cards/<nextDueId>')`); when none remain it shows the caught-up notice in place; a goal-crossing rating shows the celebration dialog **and** advances. Mechanics:

- `getDueQueue(client, excludeId)` gained an `excludeId` so an "Again" reschedule can't re-serve the just-rated card; `rateMemoryCard(..., returnNextDue)` returns the soonest-due remaining `nextDueId`.
- New `features/review/components/`: `card-review-queue.tsx` (client wrapper; server `ReviewPanel` passed as children to keep its async markdown an RSC), `queue-advance-context.tsx`, `caught-up-notice.tsx`.
- The `ReviewCelebrationProvider` is hoisted into a new `app/(protected)/memory-cards/[id]/layout.tsx` so the goal dialog survives navigating between cards (lessons.md:141). The dashboard still self-provides via `ReviewPanel` (`provideCelebration` prop).
