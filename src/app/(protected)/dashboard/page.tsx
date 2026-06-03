import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { signOut } from '@/features/auth/actions/sign-out'
import { ActivityHeatmap } from '@/features/dashboard/activity-heatmap'
import { buildHeatmapMatrix } from '@/features/dashboard/build-heatmap-matrix'
import { getDashboardData } from '@/features/dashboard/data'
import { StatCard } from '@/features/dashboard/stat-card'
import { createClient } from '@/lib/supabase/server'

// S-04 activity dashboard. NOTE: data is a UI-shell spike (dummy) until the recall loop
// (S-03) lands — see features/dashboard/data.ts.
export default async function DashboardPage() {
  const supabase = await createClient()
  // Independent reads — auth check and dashboard data don't depend on each other. Runs them
  // in parallel so this stays one round-trip once real Supabase queries replace the dummy seam.
  const [
    {
      data: { user },
    },
    data,
  ] = await Promise.all([supabase.auth.getUser(), getDashboardData()])
  const columns = buildHeatmapMatrix(data.activity, { today: new Date(), weeks: 53 })

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Signed in as {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/notes">Notes</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </header>

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

      <Card>
        <CardHeader>
          <CardTitle>Review activity — last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap columns={columns} />
        </CardContent>
      </Card>
    </main>
  )
}
