import { getDueQueue, getSoonestReviewCard } from '@/features/memory-cards/queries'
import { getDashboardData } from '@/features/dashboard/data'
import { isAccountEmpty } from '@/features/sample-data/queries'
import { getDailyGoal } from '@/features/settings/queries'
import { getCurrentUser } from '@/lib/supabase/server'

// App-layer composition: fans out every read concurrently and performs the cross-feature join here
// so features/dashboard never imports features/settings. With nothing due we fall back to the soonest
// card overall so the user can keep reviewing ahead instead of hitting a caught-up dead end.
export async function getDashboardPageData() {
  const [user, data, dueQueue, isEmpty] = await Promise.all([
    getCurrentUser(),
    getDashboardData(getDailyGoal()),
    getDueQueue(),
    isAccountEmpty(),
  ])
  const card = dueQueue.first ?? (await getSoonestReviewCard())
  // Showing a not-due card because nothing is due (vs. nothing due AND no cards at all).
  const reviewingAhead = dueQueue.count === 0 && Boolean(card)
  return { user, ...data, card, reviewingAhead, isEmpty }
}
