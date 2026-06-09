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

// `celebrate` is present only when this rating crossed a goal. `nextDueId` is the soonest-due
// remaining card (excluding the one just rated), populated only when the caller asks for it (the
// standalone card page, which advances through the queue); undefined means none are due.
export type RateResultT = ActionResultT & { celebrate?: GoalCelebrationT; nextDueId?: string }
