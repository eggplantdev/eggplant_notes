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
import { getChecksForStats } from '@/features/memory-cards/queries'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'

// Composes the dashboard's per-user reads (S-03 data wiring, expanded for the stats panel).
// The independent DB reads run in parallel; the streak + expanded stats — and the "Due today"
// count — are derived purely from the already-fetched rows (no extra query). Shape is
// DashboardDataT.
export async function getDashboardData(): Promise<DashboardDataT> {
  const [activity, checks, notes, ratings, reviewedToday] = await Promise.all([
    getReviewActivity(),
    getChecksForStats(),
    getNotesForStats(),
    getRecentRatings(STATS_WINDOW_DAYS),
    getReviewedTodayCount(),
  ])
  // "Due now" = the same `due_at <= now()` rule getDueQueue uses, derived from the checks
  // already in memory instead of a separate count query.
  const nowIso = new Date().toISOString()
  const dueToday = checks.filter((c) => c.due_at <= nowIso).length
  const currentStreak = getCurrentStreak(activity)
  const stats = computeDashboardStats({
    checks,
    notes,
    ratings,
    activity,
    today: todayInZone(APP_TIME_ZONE),
  })
  return { dueToday, reviewedToday, currentStreak, activity, stats }
}
