# Daily Goal + Today's Progress Bar — Design

**Date:** 2026-06-04
**Status:** draft (brainstorm captured; needs final variant pick + default-goal confirm before plan)
**Source:** TODO.md Cluster 3 — Dashboard features (`Daily Goal`, `Today's progress bar`)

## Problem

The dashboard shows due-today count, streak, and a heatmap, but nothing that tracks
"how am I doing against an intention _today_." Add a user-set **daily goal** and a
**Today's progress bar** that fills toward it.

## Decisions (locked in brainstorm)

| Question                 | Decision                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What fills the bar       | **Fixed reviews/day** — user sets a target number; progress = today ÷ target.                                                                                                         |
| Count unit               | **Distinct cards reviewed today** — count distinct `topic_check_id` in `review_events` where `reviewed_at` is today in `APP_TIME_ZONE` (a card re-reviewed the same day counts once). |
| Where the goal is stored | **New `user_settings` table** — first per-user setting; extensible for future settings.                                                                                               |
| Where the goal is edited | **Settings / account page** (the surface where delete-account lives). Not inline on the dashboard.                                                                                    |
| 100% behaviour           | Bar fills + glows; the goal-hit state is visually distinct.                                                                                                                           |
| Overshoot (>100%)        | Bar stays full (no overflow) with a `+N bonus` badge.                                                                                                                                 |
| Default goal             | **10 cards/day** (ASSUMPTION — user did not confirm; revisit).                                                                                                                        |

## Data model

New migration: `user_settings`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `daily_goal int not null default 10` (check `daily_goal > 0`)
- `created_at` / `updated_at timestamptz default now()`
- RLS: every row scoped by `auth.uid() = user_id` (select/insert/update), mirroring the
  existing per-user RLS pattern used by `notes` / `topic_checks` / `review_events`.
- Read path: a user with no row falls back to the default (either via row auto-insert on
  first settings save, or a `coalesce` to the default in the read). Decide at plan time;
  prefer "no row → default 10" read-side so signup needs no extra write.

## Progress computation

- Reuse the existing review-events read pattern (same as `getReviewActivity` /
  `getRecentRatings` in `src/features/review-events/queries.ts`): fetch today's events,
  bucket/count in TS — PostgREST can't group by a timezone-shifted date.
- `reviewedToday = distinct topic_check_id` over `review_events` where
  `isoDateInZone(reviewed_at, APP_TIME_ZONE) === todayStr`.
- `progress = min(reviewedToday / dailyGoal, 1)` for bar width; keep raw `reviewedToday`
  and `dailyGoal` for the label and the `+N bonus` overshoot badge.
- Lives in the dashboard feature (`src/features/dashboard/`), fed into the existing
  `DashboardStatsT` contract or a sibling read — settle in the plan.

## Visual

Cyberpunk / Blade-Runner neon, built from the **portfolio brand palette** (from
`/workspace/portfolio/old_page/styles/globals.css`):

- neon green `#10ffaa` · cyan `#00e5ff` · fuchsia `#d946ef` · on near-black `#070409`.

**Shortlisted treatments (final pick deferred):**

- **L4** — bare 4px green→cyan line, no track background/outline, sits over content. _(leading candidate)_
- **L2** — bare green→cyan line + glowing cyan head dot, no track.
- **x1** — green→cyan→fuchsia tri-stop gradient fill (boxed pill).
- **g2** — green→cyan smooth gradient with heavy glow (boxed pill).

Notes:

- Static (no animation — explicitly requested; the bob/shimmer experiments were rejected).
- Earlier directions explicitly **dropped**: Nyan-cat / rainbow-trail, pixel-art mascots,
  the eggplant logo PNG.
- Tailwind v4: express the palette via `@theme` tokens / utilities, not arbitrary
  `[...]` values or inline styles (project audit rule).

## Open items before `/10x-plan`

1. Pick ONE visual treatment from {L4, L2, x1, g2} (L4 is the working favourite).
2. Confirm default goal (assumed 10).
3. Confirm read-side default vs row-auto-insert for `user_settings`.

## Out of scope

- Multiple/period goals (weekly, per-subject), notifications, goal history/streaks of
  goal-hits. YAGNI for this slice.

---

Mockups preserved at `.superpowers/brainstorm/<session>/content/` (gitignored):
`neon-bars-compare-v2.html` (full batch), `neon-thinline.html`, `neon-bars.html`.
