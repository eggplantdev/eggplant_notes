import type { ActionResultT } from '@/types/action'

// The two counts use DIFFERENT units, each matching its dashboard bar: `dailyCount` is distinct
// cards reviewed today, `weeklyCount` is total review events in the last 7 days (a card twice counts twice).
export type GoalCelebrationT = {
  daily: boolean
  weekly: boolean
  dailyCount: number
  weeklyCount: number
  dailyGoal: number
  weeklyGoal: number
}

// `celebrate` is present only when this rating crossed a goal. The next due card is no longer
// returned here — the queue walk owns it client-side (computed at page render, prefetched), so the
// action doesn't re-query it.
export type RateResultT = ActionResultT & { celebrate?: GoalCelebrationT }
