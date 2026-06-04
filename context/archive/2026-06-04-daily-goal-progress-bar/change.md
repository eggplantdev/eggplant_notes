---
change_id: daily-goal-progress-bar
title: Daily goal + today's progress bar (neon L4 line) on the dashboard
status: archived
created: 2026-06-04
updated: 2026-06-04
archived_at: 2026-06-04T13:10:08Z
---

## Notes

TODO Cluster 3 — Dashboard features (`Daily Goal`, `Today's progress bar`). Design brainstormed and committed to `docs/superpowers/specs/2026-06-04-daily-goal-progress-bar-design.md` — read that first; it is the contract.

Locked decisions:

- **Metric:** fixed reviews/day. Progress = distinct cards reviewed today ÷ goal.
- **Count unit:** distinct `topic_check_id` in `review_events` where `reviewed_at` is today in `APP_TIME_ZONE` (reuse the `getReviewActivity` read pattern — fetch + bucket in TS).
- **Storage:** new `user_settings` table (`user_id` PK → `auth.users`, `daily_goal int not null default 10` check `> 0`, RLS by `auth.uid()`). Needs a migration + `pnpm db:types` regen.
- **Read default:** prefer "no row → default 10" read-side (no signup write).
- **Edit surface:** settings page (`src/app/(protected)/settings/page.tsx`), via a Server Action in `features/account` (or a new `features/settings`) — mirror the delete-account action/RLS pattern.
- **Visual:** L4 only — bare ~4px neon line, green `#10ffaa` → cyan `#00e5ff`, no track background/outline, sits over the dashboard content. Static (no animation). Express palette via Tailwind v4 `@theme` tokens, not arbitrary `[...]` values or inline styles.
- **100%:** filled + glow, visually distinct goal-hit state. **Overshoot >100%:** bar stays full, `+N bonus` badge.

Out of scope: weekly/per-subject goals, notifications, goal-hit history. Full per-slice gate applies (review fan-out → /simplify → tests → archive).
