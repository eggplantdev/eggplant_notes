import type { GoalCelebrationT } from '@/features/review/types'

// Pure crossing detector. A goal is "crossed" by this rating when the count went from below
// the goal to at/above it (before < goal <= after) — so it fires exactly once and never on a
// re-review that leaves the distinct-card count flat. weeklyGoal is dailyGoal * 7 (matches the
// dashboard weekly bar). Returns undefined when nothing crossed so the action omits `celebrate`.
export function detectGoalCrossing(input: {
  dailyBefore: number
  dailyAfter: number
  weeklyBefore: number
  weeklyAfter: number
  dailyGoal: number
}): GoalCelebrationT | undefined {
  const { dailyBefore, dailyAfter, weeklyBefore, weeklyAfter, dailyGoal } = input
  if (dailyGoal <= 0) return undefined
  const weeklyGoal = dailyGoal * 7
  const daily = dailyBefore < dailyGoal && dailyAfter >= dailyGoal
  const weekly = weeklyBefore < weeklyGoal && weeklyAfter >= weeklyGoal
  if (!daily && !weekly) return undefined
  return { daily, weekly, dailyCount: dailyAfter, weeklyCount: weeklyAfter, dailyGoal, weeklyGoal }
}
