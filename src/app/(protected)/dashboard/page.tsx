import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityHeatmap } from '@/features/dashboard/activity-heatmap'
import { buildHeatmapMatrix } from '@/features/dashboard/build-heatmap-matrix'
import { getDashboardData } from '@/features/dashboard/data'
import { StatCard } from '@/features/dashboard/stat-card'
import { getCurrentUser } from '@/lib/supabase/server'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'

// S-04 activity dashboard, wired to real per-user data by S-03 (features/dashboard/data.ts).
export default async function DashboardPage() {
  // getCurrentUser() is request-memoized (React cache()), so this reuses the user the
  // (protected) layout already validated — no second round-trip to Supabase Auth. The data
  // read is independent, so the two run in parallel.
  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData()])
  const columns = buildHeatmapMatrix(data.activity, {
    today: todayInZone(APP_TIME_ZONE),
    weeks: 53,
  })

  return (
    <PageShell title="Dashboard" subtitle={`Signed in as ${user?.email}`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/review"
          className="focus-visible:ring-ring rounded-xl transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
        >
          <StatCard label="Due today" value={data.dueToday} sub="topic checks ready to review" />
        </Link>
        <StatCard
          label="Current streak"
          value={
            <>
              🔥 {data.currentStreak}{' '}
              <span className="text-muted-foreground text-lg font-medium">days</span>
            </>
          }
          sub="consecutive days with ≥1 review"
        />
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Review activity — last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap columns={columns} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
