# Daily Goal + Today's Progress Bar (neon L4) — Implementation Plan

## Overview

Add a per-user **daily goal** (target distinct cards/day) and a **Today's progress bar** on
the dashboard that fills toward it. The goal is stored in a new `user_settings` table, edited
on the existing settings page, and the bar is a static neon green→cyan line (variant **L4**)
rendered at the top of the dashboard. Progress = distinct `topic_check_id` reviewed today (in
`APP_TIME_ZONE`) ÷ goal.

## Current State Analysis

- **Dashboard** composes per-user reads in `src/features/dashboard/data.ts` → `DashboardDataT`
  (`src/features/dashboard/types.ts`) and renders them in `src/app/(protected)/dashboard/page.tsx`.
  All current stats derive from already-fetched rows; there is no per-user _settings_ read.
- **Review events** reads live in `src/features/review-events/queries.ts`. `getReviewActivity`
  selects only `reviewed_at` (heatmap buckets), so it cannot give _distinct cards_ today —
  a new read that also selects `topic_check_id` is required. The TS-side zone bucketing helper
  is `isoDateInZone(date, APP_TIME_ZONE)` (`src/lib/utils/date.ts`).
- **Settings page** (`src/app/(protected)/settings/page.tsx`) currently holds only the account
  Danger zone (`DeleteAccountDialog`). It's a Server Component using `PageShell width="prose"`.
- **Mutations** go through `runTableAction` (`src/lib/supabase/run-table-action.ts`): validate
  with Zod → PostgREST write → `{success,error}`. Forms use `useAppForm`
  (`src/components/forms/hooks/form-hooks.ts`) + `toastActionResult`
  (`src/components/forms/toast-result.ts`) for inline success/error toasts on non-redirect
  mutations. `SubjectForm` (`src/features/subjects/subject-form.tsx`) is the closest template.
- **RLS pattern** (`supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql`):
  `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`, RLS
  enabled, `*_select_own`/`_insert_own`/`_update_own` policies using `(select auth.uid()) = user_id`.
- **Account deletion** cascades via the `auth.users` FK + the `delete_account()` RPC — a
  `user_settings` row with that FK is torn down automatically; no RPC change needed.
- **Theme** (`src/app/globals.css`) uses `@theme inline` tokens → generated utilities
  (e.g. `bg-heat-3`). Neon palette must be added as tokens, not arbitrary `[...]` values.
- **Types** are generated: `pnpm db:types` (`supabase gen types typescript --local`).

## Desired End State

A signed-in user sees, at the top of the dashboard, a thin neon line that fills to
`min(reviewedToday / goal, 1)` with a `13 / 20` style label; at ≥100% the line shows a
goal-hit glow and a `+N bonus` badge when over. On the settings page they can change their
daily goal; saving toasts success and the dashboard reflects the new goal on next view. A user
who never set a goal sees the default (5), because a row is auto-created at signup (existing
seed users back-filled).

### Key Discoveries:

- `getReviewActivity` drops `topic_check_id` — need a dedicated today-scoped read
  (`src/features/review-events/queries.ts:32`).
- `daily_goal` has two consumers (dashboard compute + settings edit); the **route** (app layer)
  wires `getDailyGoal` into the dashboard so no `features/dashboard → features/settings` import
  is created.
- `runTableAction` writes end in `.select().single()`; an upsert fits its envelope
  (`src/lib/supabase/run-table-action.ts:16`).
- Supabase signup-trigger pattern (SECURITY DEFINER, `set search_path = ''`) is the canonical
  way to auto-create the row.

## What We're NOT Doing

- No weekly / per-subject / multiple goals, no notifications, no goal-hit history or streaks.
- No inline goal editing on the dashboard (settings page only).
- No animation (static bar — explicitly decided).
- No other visual variants (L2/x1/g2 dropped); **L4 only**.
- No `delete_account()` RPC change (FK cascade already covers the new table).

## Implementation Approach

Bottom-up: data (migration + reads/writes) → settings edit UI → dashboard bar → tests. The
goal value is owned by a new `features/settings/` feature; the distinct-cards-today count is a
`review-events` read surfaced through the existing `getDashboardData` composition; the dashboard
route combines `getDashboardData()` (now carrying `reviewedToday`) with `getDailyGoal()` and
passes both to a presentational `DailyProgressBar`.

## Critical Implementation Details

- **Zone buffer on the today read.** `APP_TIME_ZONE` (Europe/Warsaw, UTC+1/+2) means a review
  late in the local evening can sit just before UTC midnight. The today-scoped query must fetch
  with a ≥1-day buffer (`reviewed_at >= now() - 2 days`) and then filter in TS to rows where
  `isoDateInZone(reviewed_at, APP_TIME_ZONE) === todayStr`. A naive `>= utcMidnight` would drop
  early-evening reviews from "today".
- **Single source for the default.** The DB column default and the TS `DEFAULT_DAILY_GOAL` must
  both be `5`. The signup trigger normally guarantees a row, but `getDailyGoal` still uses
  `maybeSingle()` + coalesce to the constant as defense (trigger gap / race), and `updateDailyGoal`
  upserts so a missing row self-heals.

## Phase 1: Data foundation

### Overview

Create `user_settings`, its RLS, a signup trigger + back-fill, regenerate types, and add the
settings-feature read/write plus the review-events today-count read.

### Changes Required:

#### 1. Migration: `user_settings` + RLS + signup trigger + back-fill

**File**: `supabase/migrations/<timestamp>_add_user_settings.sql` (new)

**Intent**: Store one settings row per user with the daily goal; auto-create it at signup and
back-fill existing users so every account has a row.

**Contract**: Table `user_settings` — `user_id uuid primary key references auth.users(id) on
delete cascade default auth.uid()`, `daily_goal int not null default 5 check (daily_goal > 0)`,
`created_at`/`updated_at timestamptz not null default now()`. RLS enabled; `select`/`insert`/
`update` policies own-row only via `(select auth.uid()) = user_id` (mirror the subjects
migration; no delete policy — teardown is via the FK cascade). A `SECURITY DEFINER` trigger
function (`set search_path = ''`) on `after insert on auth.users` inserts
`(user_id) values (new.id) on conflict (user_id) do nothing`. Back-fill:
`insert into public.user_settings (user_id) select id from auth.users on conflict do nothing`.

#### 2. Regenerate Supabase types

**File**: `src/lib/supabase/types.ts` (generated)

**Intent**: Make the new table available to typed clients.

**Contract**: Run the migration locally (`supabase migration up`, or `supabase db reset` —
note the AGENTS.md double-insert trap if reusing the seed) then `pnpm db:types`. Verify
`Database['public']['Tables']['user_settings']` exists.

#### 3. `features/settings` — schema, constant, read, write

**File**: `src/features/settings/schemas.ts`, `src/features/settings/constants.ts`,
`src/features/settings/queries.ts`, `src/features/settings/actions/update-daily-goal.ts` (all new)

**Intent**: Own the daily-goal value: validate it, read it (default-safe), and persist it.

**Contract**:

- `constants.ts`: `export const DEFAULT_DAILY_GOAL = 5` (must equal the DB default) + sane
  bounds, e.g. `MAX_DAILY_GOAL = 500`.
- `schemas.ts`: `dailyGoalSchema` → `{ dailyGoal: number }`, Zod `int().min(1).max(MAX_DAILY_GOAL)`
  (coerce from the form's string), exported `DailyGoalInputT`.
- `queries.ts`: `getDailyGoal(client?)` → `select('daily_goal')` `.maybeSingle()` (RLS scopes to
  the caller), coalesce null → `DEFAULT_DAILY_GOAL`. Injectable client param (Playwright rule).
- `actions/update-daily-goal.ts`: `'use server'`, `updateDailyGoal(input)` via `runTableAction`
  with upsert `from('user_settings').upsert({ user_id, daily_goal }, { onConflict: 'user_id' }).select().single()`
  (user_id from the authed client); `revalidatePath('/dashboard')` on success. Returns the
  action result.

#### 4. `review-events` — distinct-cards-today read + dashboard wiring

**File**: `src/features/review-events/queries.ts`, `src/features/dashboard/data.ts`,
`src/features/dashboard/types.ts`

**Intent**: Surface "distinct cards reviewed today" to the dashboard without altering the
heatmap read.

**Contract**: Add `getReviewedTodayCount(client?)` to review-events queries — select
`topic_check_id, reviewed_at` where `reviewed_at >= (now - 2 days)`, then count
`new Set(rows.filter(isoDateInZone === todayStr).map(r => r.topic_check_id)).size`. Add
`reviewedToday: number` to `DashboardDataT`; `getDashboardData` calls the new read in its
`Promise.all` and returns it. (Goal is NOT read here — it stays in settings; the route joins them.)

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `supabase migration up` (or `supabase db reset`)
- Types regenerated and include `user_settings`: `pnpm db:types` then `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- After `db reset`, both seed users (`dev@example.com`, `test@gmail.com`) have a `user_settings`
  row with `daily_goal = 5` (back-fill + trigger worked).
- A freshly signed-up user gets a row automatically (trigger).
- RLS: a user cannot read another user's `user_settings` row.

---

## Phase 2: Settings edit UI

### Overview

Let the user change their goal on the settings page.

### Changes Required:

#### 1. `DailyGoalForm`

**File**: `src/features/settings/daily-goal-form.tsx` (new)

**Intent**: A small numeric form to view/update the daily goal, with inline success/error toasts.

**Contract**: `'use client'`. Props `{ dailyGoal: number }`. `useAppForm` with
`defaultValues: { dailyGoal: String(dailyGoal) }`, `dailyGoalSchema` validators on blur/submit,
`field.Input` (number input), submit calls `updateDailyGoal`; `toastActionResult(result)` drives
success/error (no redirect). Mirrors `SubjectForm` structure.

#### 2. Wire into the settings page

**File**: `src/app/(protected)/settings/page.tsx`

**Intent**: Render the goal form above the Danger zone; make the page async to read the goal.

**Contract**: Make `SettingsPage` async; `const dailyGoal = await getDailyGoal()`; render a
"Preferences" `<section>` containing `<DailyGoalForm dailyGoal={dailyGoal} />` before the Danger
zone section. Import path is settings feature (app layer → feature, allowed).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Changing the goal and saving shows a success toast; reloading settings shows the new value.
- Invalid input (0, negative, non-numeric, > max) is rejected with an inline error, no write.
- After saving, the dashboard bar reflects the new goal (revalidation works).

---

## Phase 3: Dashboard L4 progress bar

### Overview

Add the neon tokens and render the static L4 line at the top of the dashboard.

### Changes Required:

#### 1. Neon theme tokens + glow

**File**: `src/app/globals.css`

**Intent**: Register the brand neon colors (and a glow) as tokens so the bar uses generated
utilities, not arbitrary values.

**Contract**: In `@theme inline` add `--color-neon-green: #10ffaa;` and
`--color-neon-cyan: #00e5ff;` (fixed brand colors, same in light/dark). Add a reusable glow as
either a `--shadow-neon` token or an `@utility neon-glow { box-shadow: 0 0 8px … }`. The bar then
uses `bg-linear-to-r from-neon-green to-neon-cyan` + the glow utility.

#### 2. `DailyProgressBar` component

**File**: `src/features/dashboard/daily-progress-bar.tsx` (new)

**Intent**: Presentational L4 bar: a 4px green→cyan line over the content with the count label,
a goal-hit glow at ≥100%, and a `+N bonus` badge on overshoot.

**Contract**: Props `{ reviewed: number; goal: number }`. Compute
`pct = goal > 0 ? Math.min(reviewed / goal, 1) : 0`, `hit = reviewed >= goal`,
`bonus = Math.max(reviewed - goal, 0)`. Render a label row (`Today's progress` + `reviewed / goal`)
and a bare ~4px line (no track bg/outline) whose filled width = `${pct*100}%` (dynamic width is a
computed inline `style`, the one allowed inline value). Extra glow + `+N bonus` badge when `hit`.
Exports only the component (`PropsT` co-located).

#### 3. Render on the dashboard

**File**: `src/app/(protected)/dashboard/page.tsx`

**Intent**: Read the goal at the route and place the bar at the top of the page.

**Contract**: Add `getDailyGoal()` to the existing `Promise.all` (route imports settings + dashboard
features — app layer). Render `<DailyProgressBar reviewed={data.reviewedToday} goal={dailyGoal} />`
as the first child inside `PageShell`, above the heatmap card.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- No pre-v4 Tailwind: the bar uses tokens/utilities, not `[...]` (spot-check / `tailwind-v4-audit`)
- Production build passes: `pnpm build`

#### Manual Verification:

- Bar width matches `reviewed/goal`; label reads `n / goal`.
- At exactly goal and beyond: glow shows; over goal shows `+N bonus` and the bar does not overflow.
- Reviewing cards in `/review` increases today's count on the dashboard.
- Readable in the app's dark theme; line sits cleanly over the content (no track box).

---

## Phase 4: Test layer

### Overview

Authored AFTER the review → `/simplify` gate (per CLAUDE.md), then run last.

### Changes Required:

#### 1. Unit specs

**File**: `src/__tests__/daily-goal.test.ts` (new)

**Intent**: Lock the default-fallback and progress math.

**Contract**: `getDailyGoal` returns `DEFAULT_DAILY_GOAL` when no row (mocked client →
`maybeSingle` null) and the stored value otherwise; the progress math (`pct` clamp, `bonus`,
`hit`) over representative inputs (0, partial, exact, overshoot). Distinct-count logic: same
card reviewed twice today counts once; a review from yesterday (zone) is excluded.

#### 2. E2E spec

**File**: `e2e/daily-goal.spec.ts` (new)

**Intent**: Prove the set-goal → dashboard-reflects loop on a self-seeded user.

**Contract**: Sign up (per-run `uniqueEmail`, `e2e/helpers.ts`), set a goal on settings, assert
the dashboard bar/label reflects it. Follow the existing e2e conventions (system Chrome, fresh
prod build, no DB reset).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm test`
- E2E passes (local Supabase up): `pnpm test:e2e`
- Full gate green: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build`

#### Manual Verification:

- No regressions in existing dashboard/settings specs.

---

## Testing Strategy

### Unit Tests:

- `getDailyGoal` default-fallback (null row → 5) and stored-value path.
- Progress math: clamp at 100%, `+N bonus`, goal-hit boundary.
- Distinct-today counting: dedupe per card; zone boundary excludes yesterday.

### Integration / E2E:

- Sign up → set goal on settings → dashboard bar + label reflect it.

### Manual Testing Steps:

1. `supabase db reset`; confirm both seed users have a `user_settings` row (`daily_goal=5`).
2. Review N distinct cards in `/review`; dashboard bar fills to `N/5`.
3. Set goal to 20 on settings; success toast; dashboard bar rescales.
4. Exceed the goal; confirm glow + `+N bonus`, no overflow.

## Performance Considerations

The today-count read is bounded to the last ~2 days of `review_events` (tiny) and runs inside
the existing dashboard `Promise.all` — one extra small query, no N+1. `getDailyGoal` is a single
indexed PK lookup.

## Migration Notes

Additive migration; no destructive changes. Back-fill covers existing users. Local apply +
`pnpm db:types` required before typecheck passes. Vercel applies migrations on deploy; no
`db reset` in prod.

## References

- Design spec: `docs/superpowers/specs/2026-06-04-daily-goal-progress-bar-design.md`
- Change identity + decisions: `context/changes/daily-goal-progress-bar/change.md`
- RLS pattern: `supabase/migrations/20260603151508_add_subjects_and_note_ordering.sql`
- Form pattern: `src/features/subjects/subject-form.tsx`
- Mutation wrapper: `src/lib/supabase/run-table-action.ts`
- Time utils: `src/lib/utils/date.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data foundation

#### Automated

- [x] 1.1 Migration applies cleanly (`supabase migration up` / `db reset`) — e23f199
- [x] 1.2 Types regenerated, include `user_settings`, `pnpm typecheck` passes — e23f199
- [x] 1.3 Linting passes (`pnpm lint`) — e23f199

#### Manual

- [x] 1.4 Both seed users have a `user_settings` row (`daily_goal = 5`) — e23f199
- [x] 1.5 A freshly signed-up user gets a row automatically (trigger) — e23f199
- [x] 1.6 RLS prevents reading another user's `user_settings` — e23f199

### Phase 2: Settings edit UI

#### Automated

- [x] 2.1 Type checking passes (`pnpm typecheck`)
- [x] 2.2 Linting passes (`pnpm lint`)

#### Manual

- [x] 2.3 Save shows success toast; reload shows new value
- [x] 2.4 Invalid input rejected inline, no write
- [ ] 2.5 Dashboard bar reflects the new goal after save (revalidation) — blocked on Phase 3 bar

### Phase 3: Dashboard L4 progress bar

#### Automated

- [x] 3.1 Type checking passes (`pnpm typecheck`) — 7fcbffd
- [x] 3.2 Linting passes (`pnpm lint`) — 7fcbffd
- [x] 3.3 No pre-v4 Tailwind (tokens/utilities only) — 7fcbffd
- [x] 3.4 Production build passes (`pnpm build`) — 7fcbffd

#### Manual

- [ ] 3.5 Bar width + label match `reviewed/goal`
- [ ] 3.6 Goal-hit glow + `+N bonus` on overshoot, no overflow
- [ ] 3.7 Reviewing cards increases today's count on the dashboard
- [ ] 3.8 Reads cleanly in the dark theme (line over content, no track box)

### Phase 4: Test layer

#### Automated

- [x] 4.1 Unit tests pass (`pnpm test`) — 51/51 green — 21e6431
- [ ] 4.2 E2E passes (`pnpm test:e2e`) — authored (e2e/daily-goal.spec.ts); not run, skipped per user
- [ ] 4.3 Full gate green (typecheck + lint + test + e2e + build) — typecheck+lint+test+build green; e2e skipped per user

#### Manual

- [ ] 4.4 No regressions in existing dashboard/settings specs
