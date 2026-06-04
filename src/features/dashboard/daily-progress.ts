// Pure progress math for the daily-goal bar, kept apart from DailyProgressBar (the component)
// so it's unit-testable without rendering — same split rationale as review-events/streak.ts
// sitting apart from its query. pct clamps at 1 (the bar never overflows); hit marks the
// goal-met state; bonus is the overshoot beyond goal.
export type DailyProgressT = { pct: number; hit: boolean; bonus: number }

export function computeDailyProgress(reviewed: number, goal: number): DailyProgressT {
  const pct = goal > 0 ? Math.min(reviewed / goal, 1) : 0
  const hit = reviewed >= goal
  const bonus = Math.max(reviewed - goal, 0)
  return { pct, hit, bonus }
}
