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

// Composes the dashboard's per-user reads (S-03 data wiring, expanded for the stats panel).
// The independent DB reads run in parallel; the streak + expanded stats — and the "Due today"
// count — are derived purely from the already-fetched rows (no extra query). Shape is
// DashboardDataT.
//
// `dailyGoalPromise` is the already-kicked-off settings read, handed in unawaited by the route
// loader. The streaks are goal-relative, so we await it INSIDE this fan-out — that keeps the
// goal fetch parallel with everything else AND keeps features/dashboard free of a
// features/settings import (the cross-feature wiring lives in the app-layer loader).
export async function getDashboardData(dailyGoalPromise: Promise<number>): Promise<DashboardDataT> {
  const [activity, cards, notes, ratings, reviewedToday, dailyGoal] = await Promise.all([
    getReviewActivity(),
    getCardsForStats(),
    getNotesForStats(),
    getRecentRatings(STATS_WINDOW_DAYS),
    getReviewedTodayCount(),
    dailyGoalPromise,
  ])
  // "Due now" = the same `due_at <= now()` rule getDueQueue uses, derived from the cards
  // already in memory instead of a separate count query.
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
