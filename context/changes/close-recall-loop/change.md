---
change_id: close-recall-loop
roadmap_id: S-03
linear: EX-363
title: Close the recall loop — review a due topic check, self-rate, reschedule
status: impl_reviewed
created: 2026-06-03
updated: 2026-06-03
prerequisites: [S-02 attach-topic-checks, F-02 persistence-and-isolation]
---

# S-03: Close the recall loop (NORTH STAR)

The dashboard surfaces topic checks due for review; the user reviews one, self-rates
Again/Hard/Good/Easy, the system reschedules its next due date via **FSRS** (ts-fsrs),
records a `review_event`, and shows when it is next due (FR-016–019).

This is the validation milestone — the first moment the product's core hypothesis
(adaptive scheduling drives retention) is proven end-to-end.

## Locked decisions (from planning, 2026-06-03)

- **Algorithm: ts-fsrs (FSRS)** — accept the migration cost. Replaces the shipped SM-2
  columns; `review_events.rating` check changes `0–5 → 1–4` (the F-02 "rating locked to
  SM-2 0–5" decision is intentionally reversed here).
- **Placement: dedicated `/review` route** + fill S-04's `features/dashboard/data.ts` seam.
  S-04's dashboard shell is already on `main` (HEAD 587d95b); branch S-03 off it.
- **Session: sequential queue, one card at a time**, server-driven (revalidate → next card),
  "All caught up" empty state.
- **Atomicity: Postgres RPC** (`record_review`), `SECURITY INVOKER` + RLS, single transaction.
  ts-fsrs computes the new state in TS; the RPC only persists (event insert + card update).
- **Interval preview on rating buttons** (Anki-style) via `scheduler.repeat(card, now)`.
- **Due = `due_at <= now()` inclusive** — reuse the existing `getTopicChecksDue` helper.

See `plan.md` (full) and `plan-brief.md` (2-pager).
