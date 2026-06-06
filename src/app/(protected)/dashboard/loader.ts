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
  // Start the settings read here (app layer owns the cross-feature wiring) and hand the
  // unawaited promise to getDashboardData, which awaits it inside its own fan-out for the
  // goal-relative streaks. `dailyGoal` comes back as part of `data`.
  const [user, data, { first: card }] = await Promise.all([
    getCurrentUser(),
    getDashboardData(getDailyGoal()),
    getDueQueue(),
  ])
  return { user, ...data, card }
}
