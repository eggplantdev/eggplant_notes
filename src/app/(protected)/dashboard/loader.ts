import { getDashboardData } from '@/features/dashboard/data'
import { getSoonestDueCard } from '@/features/memory-cards/queries'
import { isAccountEmpty } from '@/features/sample-data/queries'
import { getDailyGoal } from '@/features/settings/queries'
import { getCurrentUser } from '@/lib/supabase/server'

// App-layer composition: fans out every read concurrently and performs the cross-feature join here
// so features/dashboard never imports features/settings. The review section is read-only (reviewing
// moved to /memory-cards), so we fetch the soonest-due card in the lean listing projection (no answer
// text), not the full DueCardT + count getDueQueue returns.
export async function getDashboardPageData() {
  const [user, data, dueCard, isEmpty] = await Promise.all([
    getCurrentUser(),
    getDashboardData(getDailyGoal()),
    getSoonestDueCard(),
    isAccountEmpty(),
  ])
  return { user, ...data, dueCard, isEmpty }
}
