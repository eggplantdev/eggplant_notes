import type { ActionResultT } from '@/types/action'

// Payload describing a goal crossing detected during a single review rating. `daily`/`weekly`
// flag which goal was crossed by THIS rating (both can be true → one combined dialog). The
// counts are post-rating, for the "20/20" copy. NOTE: the two counts use DIFFERENT units, each
// matching its dashboard bar — `dailyCount` is distinct cards reviewed today, `weeklyCount` is
// total review events in the last 7 days (a card reviewed twice counts twice).
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
