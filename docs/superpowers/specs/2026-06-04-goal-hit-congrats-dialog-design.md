# Goal-hit congrats dialog — design

**Date:** 2026-06-04
**Status:** approved (pending spec review)

## Problem

The dashboard's `GoalProgressBar` (daily + weekly) renders a "Goal hit" state, but it
only _reflects_ an already-met goal at render time. There is no celebratory moment when a
user actually reaches a goal. We want a congrats dialog (with confetti) that fires the
moment a review pushes the daily or weekly review count across its goal threshold.

## Decisions (locked with user)

1. **Trigger:** on _crossing_, during the review session. Never on dashboard load, never
   re-fired on revisits.
2. **Both goals crossed by the same rating:** one combined dialog.
3. **Content:** minimal congrats copy + the count hit + confetti. Single Close.
4. **Confetti:** `canvas-confetti` dependency (accepted).
5. **Daily-goal source:** route-join — the review page reads `getDailyGoal()` and passes
   it down, mirroring how the dashboard route already avoids
   `features/dashboard → features/settings`. No promotion, no cross-feature deep import.

## Why server-detected crossing

The only place a review count changes is `rateTopicCheck`. The client cannot reliably know
"before vs after" because the rate action revalidates `/review` and the next card streams
in, resetting any client-held count. So the **server** detects the crossing inside the
action and returns a celebration payload; the client renders the dialog from it. Single
source of truth, correct counting, exactly-on-crossing.

## Counting semantics (must match each bar)

The two dashboard bars count differently, so crossing detection mirrors each:

- **Daily** = distinct cards reviewed today, zone-bucketed — `getReviewedTodayCount()`.
- **Weekly** = total review events in the last 7 days (`today − 6d`, zone-bucketed) — same
  window as `stats.ts` `reviewsThisWeek`. Needs a new focused query
  `getReviewsThisWeekCount()` in `features/review-events/queries.ts`.

Weekly goal = `dailyGoal * 7` (same as the dashboard's weekly bar).

## Data flow

1. **Review page** (`app/(protected)/review/page.tsx`, server component) reads
   `getDailyGoal()` alongside the due queue and passes `goal` to `RatingButtons` as a prop.
   This is the composition layer — the mutation-side analogue of the dashboard route.
2. **`RatingButtons`** (client) calls `rateTopicCheck(topicCheckId, grade, goal)`.
3. **`rateTopicCheck`** (server action):
   - Validate `goal` with a small Zod schema (positive int) as defense — it is cosmetic
     (only gates a dialog), so passing it via the client carries no integrity risk, but we
     still validate shape.
   - Read **before-counts** (`getReviewedTodayCount`, `getReviewsThisWeekCount`) in parallel
     with the existing card-row fetch — no added latency there.
   - Run the existing `record_review` RPC (unchanged).
   - Read **after-counts** (one extra round trip).
   - Compute crossing via a pure helper `detectGoalCrossing(...)`.
   - Return `{ success: true, celebrate? }`.
4. **`RatingButtons`** reads `result.celebrate` from `run()` and opens
   `GoalCelebrationDialog`, which fires `canvas-confetti` on open.

We read both before- and after-counts for **both** metrics and use one uniform test
(`before < goal && after >= goal`) rather than per-metric shortcuts (weekly is monotonic
+1, daily can stay flat on a re-review). Clarity over saving two tiny indexed reads.

## Types & return contract

```ts
// features/review/types.ts (new or extend)
export type GoalCelebrationT = {
  daily: boolean // daily goal crossed by this rating
  weekly: boolean // weekly goal crossed by this rating
  dailyCount: number // count after the rating (for "20/20" copy)
  weeklyCount: number
  dailyGoal: number
  weeklyGoal: number
}

// rate-topic-check.ts return type — superset of ActionResultT, NOT a change to the shared type
type RateResultT = ActionResultT & { celebrate?: GoalCelebrationT }
```

`useActionTransition.run` becomes generic so callers receive the precise return type:

```ts
function run<T extends ActionResultT>(
  action: () => Promise<T>,
  opts?: { successMessage?: string },
): Promise<T>
```

Zero change for existing callers (they still get `ActionResultT`); `RatingButtons` gets the
`celebrate` field typed. The shared `ActionResultT` is untouched.

## Pure crossing helper (unit-tested)

```ts
// features/review/detect-goal-crossing.ts
export function detectGoalCrossing(input: {
  dailyBefore: number
  dailyAfter: number
  weeklyBefore: number
  weeklyAfter: number
  dailyGoal: number
}): GoalCelebrationT | undefined
```

Returns `undefined` when nothing crossed (action returns no `celebrate`). Tests cover:
daily-only crossing, weekly-only, both-at-once (combined), re-review that doesn't increment
daily (no crossing), goal already exceeded (no re-fire), `goal <= 0` guard.

## UI component

`features/review/goal-celebration-dialog.tsx` — shadcn `Dialog` (already present), neon
theme matching the goal bar (`neon-glow-hit`, `text-neon-cyan`). Copy adapts to which goal
crossed:

- both → "Daily + weekly goal hit!" with both counts
- daily → "Daily goal hit! · {dailyCount}/{dailyGoal}"
- weekly → "Weekly goal hit! · {weeklyCount}/{weeklyGoal}"

Single Close button. `canvas-confetti` fires once on open. `RatingButtons` owns the open
state; closing clears it. No `useEffect` for the trigger — open state is set in the `run()`
resolution callback (event-driven, not effect-driven), per the project's no-`useEffect`
rule. Confetti fire happens in the dialog's open handler.

## Files touched

| File                                          | Change                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| `app/(protected)/review/page.tsx`             | read `getDailyGoal()`, pass `goal` prop              |
| `features/review/rating-buttons.tsx`          | accept `goal` prop, pass to action, own dialog state |
| `features/review/actions/rate-topic-check.ts` | before/after counts, crossing, return `celebrate`    |
| `features/review/detect-goal-crossing.ts`     | **new** pure helper                                  |
| `features/review/goal-celebration-dialog.tsx` | **new** dialog + confetti                            |
| `features/review/types.ts`                    | `GoalCelebrationT`                                   |
| `features/review/schemas.ts`                  | small `goalSchema` (positive int)                    |
| `features/review-events/queries.ts`           | **new** `getReviewsThisWeekCount()`                  |
| `hooks/use-action-transition.ts`              | make `run` generic                                   |
| `package.json`                                | add `canvas-confetti` + `@types/canvas-confetti`     |
| `src/__tests__/...`                           | unit test for `detectGoalCrossing`                   |

## Rejected alternatives

- **Client-computed crossing** from returned counts — needs seeded prior-count state that
  breaks across the card-advance revalidate.
- **Dashboard-load detection** — re-pops on every visit; contradicts the crossing-only
  decision.
- **Promote `getDailyGoal` to a shared tier** — no shared query tier exists; `lib/` forbids
  domain knowledge; deletion test says the read belongs to `features/settings`. Route-join
  is the documented precedent.
- **Action imports `features/settings` directly** — the forbidden cross-feature deep import.

## Out of scope / flag

- There are currently **two** untracked `goal-progress-bar.tsx` files (`components/ui/` and
  `features/dashboard/`); the page imports the `features/dashboard` one. The `components/ui`
  copy is a stray duplicate — flagged for cleanup, not touched by this change.
- No persistence of "already celebrated" — a hard reload mid-session won't re-fire because
  the crossing already happened (count no longer equals the threshold-minus-one on the next
  rating). Acceptable per the crossing-only decision.
  </content>
  </invoke>
