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
import { getDailyGoal } from '@/features/settings/queries'

export async function getDashboardData(): Promise<DashboardDataT> {
  const [dayCounts, cardStats, dailyGoal] = await Promise.all([
    getReviewDayCounts(),
    getCardStats(),
    getDailyGoal(),
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
