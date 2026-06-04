import type { ActionResultT } from '@/types/action'

// Payload describing a goal crossing detected during a single review rating. `daily`/`weekly`
// flag which goal was crossed by THIS rating (both can be true → one combined dialog). The
// counts are post-rating, for the "20/20" copy.
export type GoalCelebrationT = {
  daily: boolean
  weekly: boolean
  dailyCount: number
  weeklyCount: number
  dailyGoal: number
  weeklyGoal: number
}

// rateTopicCheck's return contract: the shared action envelope plus an optional celebration.
// A superset of ActionResultT (the shared type is untouched); `celebrate` is present only when
// a goal was crossed.
export type RateResultT = ActionResultT & { celebrate?: GoalCelebrationT }
