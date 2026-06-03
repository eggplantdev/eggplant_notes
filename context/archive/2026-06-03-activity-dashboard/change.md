---
change_id: activity-dashboard
roadmap_id: S-04
linear: EX-364
title: Activity dashboard — due-today count, current streak, review heatmap
status: archived
created: 2026-06-03
updated: 2026-06-03
archived_at: 2026-06-03T17:08:39Z
---

## Notes

**Back-fill change record.** S-04 shipped without its own lifecycle folder — its code
landed across two streams, so this folder reconciles the tracking after the fact rather
than driving fresh planning/implementation. No `/10x-plan` or `/10x-implement` was run
(the code already exists and passed review under S-03's gate).

What shipped (FR-020–022, v1):

- **UI shell** — built standalone, merged to `main` as `587d95b`. Commits
  `e648e17` (S-04 UI shell, dummy data) → `adcec0e` / `5e5561e` / `0d9dcdb`
  (split into cohesive modules, v4 utilities, date helpers → `utils/`).
- **Real data wiring** — folded into S-03 `close-recall-loop` as phase 4
  (`4828dbc` "wire dashboard data seam to real reviews") + impl-review refactor
  `5c5ff30` (promote shared tier + bound activity read).

Surface on disk:

- `src/app/(protected)/dashboard/page.tsx` — Due-today + streak stat cards, 53-week heatmap.
- `src/features/dashboard/` — `data.ts` composes the per-user reads; `build-heatmap-matrix.ts`,
  `activity-heatmap.tsx`, `heatmap-*`, `stat-card.tsx`, `types.ts`, `constants.ts`.
- `src/features/topic-checks/queries.ts#getDueCount`,
  `src/features/review-events/queries.ts#{getReviewActivity,getCurrentStreak}`.
- `e2e/dashboard.spec.ts` — review-gate coverage.

Dependency: data layer rides on **S-03** (`close-recall-loop`) — archive after S-03 clears
its gate so this isn't recorded `done` ahead of the change it depends on.
