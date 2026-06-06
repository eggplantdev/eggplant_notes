import { STATS_WINDOW_DAYS } from '@/features/dashboard/constants'
import { computeDashboardStats } from '@/features/dashboard/stats'
import type { DashboardDataT } from '@/features/dashboard/types'
import { getNotesForStats } from '@/features/notes/queries'
import {
  getRecentRatings,
  getReviewActivity,
  getReviewedTodayCount,
} from '@/features/review-events/queries'
import { getCurrentStreak } from '@/features/review-events/streak'
import { getCardsForStats } from '@/features/memory-cards/queries'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'

// `dailyGoalPromise` is handed in unawaited by the route loader and awaited INSIDE this fan-out:
// keeps the goal fetch parallel AND keeps features/dashboard free of a features/settings import.
export async function getDashboardData(dailyGoalPromise: Promise<number>): Promise<DashboardDataT> {
  const [activity, cards, notes, ratings, reviewedToday, dailyGoal] = await Promise.all([
    getReviewActivity(),
    getCardsForStats(),
    getNotesForStats(),
    getRecentRatings(STATS_WINDOW_DAYS),
    getReviewedTodayCount(),
    dailyGoalPromise,
  ])
  // "Due now" = getDueQueue's `due_at <= now()` rule, derived from in-memory cards (no extra query).
  const nowIso = new Date().toISOString()
  const dueToday = cards.filter((c) => c.due_at <= nowIso).length
  const currentStreak = getCurrentStreak(activity, dailyGoal)
  const stats = computeDashboardStats({
    cards,
    notes,
    ratings,
    today: todayInZone(APP_TIME_ZONE),
  })
  return { dueToday, reviewedToday, currentStreak, dailyGoal, activity, stats }
}
