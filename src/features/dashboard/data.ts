import { getCardStats } from '@/features/dashboard/queries'
import type { DashboardDataT, DashboardStatsT } from '@/features/dashboard/types'
import {
  reviewedTodayCount,
  reviewsThisWeekCount,
  reviewWindowKeys,
  toActivity,
} from '@/features/review-events/derive-counts'
import { getReviewDayCounts } from '@/features/review-events/queries'
import { getCurrentStreak } from '@/features/review-events/streak'

// `dailyGoalPromise` is handed in unawaited by the route loader and awaited INSIDE this fan-out:
// keeps the goal fetch parallel AND keeps features/dashboard free of a features/settings import.
// Two reads now: per-day review tallies (RPC, all history — feeds heatmap/streak/today/week) and
// the card_stats RPC (overdue/due/window/hardest). Aggregation runs in SQL, not over fetched rows.
export async function getDashboardData(dailyGoalPromise: Promise<number>): Promise<DashboardDataT> {
  const [dayCounts, cardStats, dailyGoal] = await Promise.all([
    getReviewDayCounts(),
    getCardStats(),
    dailyGoalPromise,
  ])

  const activity = toActivity(dayCounts)
  const { todayStr, weekStartStr } = reviewWindowKeys()
  const currentStreak = getCurrentStreak(activity, dailyGoal)

  const stats: DashboardStatsT = {
    overdue: cardStats.overdue,
    reviewsInWindow: cardStats.reviewsInWindow,
    reviewsThisWeek: reviewsThisWeekCount(dayCounts, weekStartStr),
    retention: cardStats.reviewsInWindow > 0 ? cardStats.good / cardStats.reviewsInWindow : null,
    hardestCards: cardStats.hardest,
  }

  return {
    dueToday: cardStats.dueNow,
    reviewedToday: reviewedTodayCount(dayCounts, todayStr),
    currentStreak,
    dailyGoal,
    activity,
    stats,
  }
}
