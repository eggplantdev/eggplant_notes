---
change_id: memory-card-review-page
title: Standalone memory-card page with on-demand review buttons
status: implementing
created: 2026-06-06
updated: 2026-06-06
archived_at: null
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
