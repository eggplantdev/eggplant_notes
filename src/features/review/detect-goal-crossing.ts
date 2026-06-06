import type { GoalCelebrationT } from '@/features/review/types'

// Crossed = count went `before < goal <= after`, so it fires exactly once and never on a flat
// re-review. weeklyGoal is dailyGoal * 7. Returns undefined when nothing crossed.
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
