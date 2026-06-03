import type { DashboardDataT } from '@/features/dashboard/types'
import { getCurrentStreak, getReviewActivity } from '@/features/review-events/queries'
import { getDueCount } from '@/features/topic-checks/queries'

// Composes the dashboard's per-user reads (S-03 data wiring). The two DB reads are independent,
// so they run in parallel; the streak is derived purely from the already-fetched activity series
// (no third query). Shape is DashboardDataT (S-04 contract) — unchanged.
export async function getDashboardData(): Promise<DashboardDataT> {
  const [dueToday, activity] = await Promise.all([getDueCount(), getReviewActivity()])
  const currentStreak = getCurrentStreak(activity)
  return { dueToday, currentStreak, activity }
}
