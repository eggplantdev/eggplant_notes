import { getDashboardData } from '@/features/dashboard/data'
import { getDueQueue } from '@/features/memory-cards/queries'
import { getDailyGoal } from '@/features/settings/queries'
import { getCurrentUser } from '@/lib/supabase/server'

// Route-level (app-layer) data composition for /dashboard: fans out every read the page needs
// in ONE Promise.all and performs the cross-feature join here — dashboard data + settings goal
// + memory-cards due queue + auth user — so features/dashboard never imports features/settings.
// getCurrentUser() is request-memoized (React cache()), so it reuses the user the (protected)
// layout already validated; all reads run concurrently.
export async function getDashboardPageData() {
  const [user, data, dailyGoal, { first: card }] = await Promise.all([
    getCurrentUser(),
    getDashboardData(),
    getDailyGoal(),
    getDueQueue(),
  ])
  return { user, ...data, dailyGoal, card }
}
