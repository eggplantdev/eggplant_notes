# Close the Recall Loop (S-03) — Plan Brief

> Full plan: `context/changes/close-recall-loop/plan.md`

## What & Why

Close the product's core loop: surface due topic checks, let the user self-rate
Again/Hard/Good/Easy, reschedule the next review with an adaptive algorithm (**FSRS**), and log
the review. This is the **north star** — the first end-to-end proof that adaptive scheduling
works. Everything else only matters if this loop feels right.

## Starting Point

The schema is present but unwritten: `topic_checks` has SM-2 columns and `review_events.rating`
is a 0–5 check (F-02). `getTopicChecksDue()` already exists (`due_at <= now()` + index). The
S-04 dashboard shell is **already on `main`** (HEAD 587d95b) with a `data.ts` dummy seam that
explicitly delegates due-count/streak/activity wiring to S-03. No SRS library is installed.

## Desired End State

A user with due checks sees a "Due today" count on the dashboard, clicks to `/review`, reviews
checks **one at a time** with four rating buttons each previewing its next interval (`Good · 4d`),
and each rating atomically logs an event + reschedules the card. Empty queue → "All caught up".
The dashboard's count/streak/heatmap show real data.

## Key Decisions Made

| Decision         | Choice                                               | Why                                                                          | Source |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Algorithm        | **ts-fsrs (FSRS)**, accept migration                 | Best accuracy + 1:1 button mapping; user chose it over the cheaper SM-2 fit  | Plan   |
| Schema           | Drop SM-2 cols, add FSRS state; rating `0–5 → 1–4`   | FSRS needs its own state; no prod data to migrate                            | Plan   |
| Review placement | Dedicated `/review` route + fill S-04 `data.ts` seam | S-04 owns the dashboard shell; clean ownership split, no `page.tsx` conflict | Plan   |
| Session flow     | Sequential, one card at a time (server-driven)       | Matches SRS mental model + "no more due" end state; no client queue state    | Plan   |
| Write atomicity  | Postgres RPC `record_review`, `SECURITY INVOKER`     | Event + reschedule can never partially apply; one round-trip = instant       | Plan   |
| Interval preview | Anki-style under each button (`repeat()`)            | Satisfies FR-019 at the moment it matters; nearly free                       | Plan   |
| Due semantics    | `due_at <= now()` inclusive (reuse existing helper)  | Matches shipped helper + index; "never dropped" holds                        | Plan   |

## Scope

**In scope:** FSRS migration + RPC, ts-fsrs scheduling module, rate Server Action, `/review`
session UI, dashboard "Due today" link, filling S-04's data seam, unit + E2E tests.

**Out of scope:** dashboard UI (S-04 owns it), FSRS parameter optimization, per-check history UI,
topic-check editing (S-02), SM-2 column preservation.

## Architecture / Approach

FSRS runs in **TypeScript, server-side**. The `/review` Server Component fetches due checks,
computes each card's four-outcome preview with `repeat()`, and renders one card + a client rating
island. A rating triggers a Server Action that **re-fetches the card** (server-trusted), computes
the next state with `next()`, and calls the `record_review` RPC (atomic event-insert +
card-update). `revalidatePath('/review')` drops the rated card and shows the next — no client
queue state, no `useEffect`.

## Phases at a Glance

| Phase                      | Delivers                                                            | Key risk                                                |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Schema + dep + typegen  | FSRS columns, rating `1..4`, `record_review` RPC, ts-fsrs installed | Migration correctness; SECURITY INVOKER + RLS behaviour |
| 2. Scheduling + write path | `scheduling.ts` (ts-fsrs wrapper), rate Server Action               | Row↔Card date serialization; server-trusting the rating |
| 3. /review UI              | Sequential session, previewed buttons, empty state, dashboard link  | Server-driven advance UX; ~360px layout                 |
| 4. Dashboard data seam     | Real `getDashboardData` (due/streak/activity)                       | Streak/activity aggregation correctness                 |
| 5. E2E                     | Full-loop + RLS-isolation Playwright spec                           | Local-GoTrue sign-up flake (environmental)              |

**Prerequisites:** S-02 + F-02 (met); S-04 dashboard shell merged to `main` (met, HEAD 587d95b).
Branch S-03 off current `main`.
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Reverses the F-02 "rating locked to SM-2 0–5" decision — accepted deliberately; no prod data.
- ts-fsrs `Card` field set (incl. `learning_steps`) must match the installed version — verify at
  install; serialization is isolated in `scheduling.ts`.
- Dropping SM-2 columns assumes no reader writes them (verified: only `select('*')` readers).

## Success Criteria (Summary)

- A user completes review → rate → reschedule end-to-end; the check leaves the due queue and a
  `review_events` row + future `due_at` exist.
- After the first review the dashboard reads streak = 1 and the heatmap marks today (PRD success
  criterion).
- A second user can never see or review another user's checks (RLS).
