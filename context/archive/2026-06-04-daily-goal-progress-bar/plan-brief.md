# Daily Goal + Today's Progress Bar (neon L4) — Plan Brief

> Full plan: `context/changes/daily-goal-progress-bar/plan.md`
> Design spec: `docs/superpowers/specs/2026-06-04-daily-goal-progress-bar-design.md`

## What & Why

The dashboard tracks history (streak, heatmap, due count) but nothing about intent _today_.
Add a user-set **daily goal** and a **Today's progress bar** that fills toward it, so the user
has a concrete daily target that reinforces the review habit.

## Starting Point

The dashboard composes per-user reads in `features/dashboard/data.ts` and has no per-user
_settings_. Review events are read in `features/review-events/queries.ts` but the heatmap read
drops `topic_check_id`. The settings page holds only the account Danger zone. Mutations use the
`runTableAction` wrapper + `useAppForm`/`toastActionResult` (template: `SubjectForm`).

## Desired End State

A thin neon green→cyan line sits at the top of the dashboard, filled to
`min(reviewedToday / goal, 1)` with a `n / goal` label, a goal-hit glow at ≥100%, and a
`+N bonus` badge on overshoot. The goal is editable on the settings page (success toast,
dashboard revalidates). Users always have a goal (default 5) because a row is auto-created at
signup; existing seed users are back-filled.

## Key Decisions Made

| Decision        | Choice                                            | Why                                                                   | Source |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| Goal metric     | Fixed distinct-cards/day                          | Stable, explainable target; overshoot handled by badge                | Frame  |
| Count unit      | Distinct `topic_check_id` today (`APP_TIME_ZONE`) | "Studied N cards" truer than raw event count                          | Frame  |
| Storage         | New `user_settings` table, RLS like `subjects`    | First per-user setting; extensible                                    | Frame  |
| Default goal    | **5**                                             | Almost-always-reachable → strongest habit reinforcement               | Plan   |
| Feature home    | New `features/settings/`                          | Clean home; route joins it into dashboard (no feature→feature import) | Plan   |
| No-row handling | **Auto-insert at signup** (trigger + back-fill)   | Every user always has a row; read stays defensive too                 | Plan   |
| Visual          | **L4** only — bare 4px neon line, static          | Picked from the mockup round; no animation                            | Spec   |

## Scope

**In scope:** `user_settings` migration + RLS + signup trigger + back-fill; settings feature
(schema/read/upsert action/form); review-events distinct-today read; neon `@theme` tokens;
`DailyProgressBar`; settings + dashboard wiring; unit + e2e tests.

**Out of scope:** weekly/per-subject/multiple goals, notifications, goal-hit history, inline
dashboard editing, animation, the other visual variants, `delete_account` RPC changes.

## Architecture / Approach

`features/settings` owns the goal value (schema, `getDailyGoal` default-safe read, `updateDailyGoal`
upsert). `features/review-events` gains a bounded distinct-cards-today read, surfaced through the
existing `getDashboardData` composition as `reviewedToday`. The dashboard **route** combines
`getDashboardData()` + `getDailyGoal()` and passes both to a presentational `DailyProgressBar` —
keeping the cross-consumer join at the app layer, not as a feature→feature import.

## Phases at a Glance

| Phase               | What it delivers                                        | Key risk                                            |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| 1. Data foundation  | Table + RLS + trigger + back-fill + types + reads/write | Trigger/back-fill correctness; types regen ordering |
| 2. Settings edit UI | `DailyGoalForm` on the settings page                    | Validation + revalidation correctness               |
| 3. Dashboard L4 bar | Neon tokens + `DailyProgressBar` at top of dashboard    | Tailwind v4 token discipline; zone-correct count    |
| 4. Test layer       | Unit (fallback, math) + e2e (set→reflect)               | Authored after review/simplify per gate             |

**Prerequisites:** local Supabase stack up (`supabase start`); run migration + `pnpm db:types`
before typecheck.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Default `5` lives in two places (DB column default + `DEFAULT_DAILY_GOAL`); they must stay equal.
- Zone buffer: the today-read must fetch a ≥1-day window and filter in TS by `isoDateInZone`,
  or late-evening reviews fall out of "today".
- Signup trigger must be `SECURITY DEFINER` with `set search_path = ''`; the read stays
  `maybeSingle()` + coalesce as defense against a trigger gap.

## Success Criteria (Summary)

- A user can set a daily goal on settings and the dashboard bar reflects it.
- The bar shows distinct cards reviewed today vs goal, with goal-hit glow + `+N bonus` overshoot.
- Every user (new + existing seed) has a goal with no manual setup; default is 5.
