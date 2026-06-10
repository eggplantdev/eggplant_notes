import { getDashboardData } from '@/features/dashboard/data'
import { getDueQueue } from '@/features/memory-cards/queries'
import { isAccountEmpty } from '@/features/sample-data/queries'
import { getDailyGoal } from '@/features/settings/queries'
import { getCurrentUser } from '@/lib/supabase/server'

// App-layer composition: fans out every read concurrently and performs the cross-feature join here
// so features/dashboard never imports features/settings.
export async function getDashboardPageData() {
  const [user, data, { first: card }, isEmpty] = await Promise.all([
    getCurrentUser(),
    getDashboardData(getDailyGoal()),
    getDueQueue(),
    isAccountEmpty(),
  ])
  return { user, ...data, card, isEmpty }
}
