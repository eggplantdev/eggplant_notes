import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityHeatmap } from '@/features/dashboard/activity-heatmap'
import { buildHeatmapMatrix } from '@/features/dashboard/build-heatmap-matrix'
import { getDashboardData } from '@/features/dashboard/data'
import { DueForecast } from '@/features/dashboard/due-forecast'
import { HardestCards } from '@/features/dashboard/hardest-cards'
import { StatCard } from '@/features/dashboard/stat-card'
import { StateBreakdown } from '@/features/dashboard/state-breakdown'
import { SubjectRollup } from '@/features/dashboard/subject-rollup'
import { getCurrentUser } from '@/lib/supabase/server'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'

// Format a 0–1 fraction as a whole-percent string; em-dash when there's no data yet.
const pct = (f: number | null) => (f === null ? '—' : `${Math.round(f * 100)}%`)

// S-04 activity dashboard, wired to real per-user data by S-03 (features/dashboard/data.ts),
// expanded with the full stats panel. NOTE: this renders every available stat at once for the
// cull pass — trim the cards/sections you don't want, then their fields in computeDashboardStats.
export default async function DashboardPage() {
  // getCurrentUser() is request-memoized (React cache()), so this reuses the user the
  // (protected) layout already validated — no second round-trip to Supabase Auth. The data
  // read is independent, so the two run in parallel.
  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData()])
  const s = data.stats
  const columns = buildHeatmapMatrix(data.activity, {
    today: todayInZone(APP_TIME_ZONE),
    weeks: 53,
  })

  // Scalar stats rendered as a uniform StatCard grid. Cull a line to drop the card.
  const scalars = [
    { label: 'Longest streak', value: s.longestStreak, sub: 'best consecutive-day run' },
    { label: 'Total cards', value: s.totalCards, sub: 'topic checks across all notes' },
    { label: 'Total notes', value: s.totalNotes, sub: 'notes in your library' },
    { label: 'Subjects', value: s.totalSubjects, sub: 'subjects organizing notes' },
    { label: 'Overdue', value: s.overdue, sub: 'cards past their due date' },
    { label: 'Mature cards', value: s.matureCards, sub: 'stability ≥ 21 days' },
    { label: 'Young cards', value: s.youngCards, sub: 'still stabilizing' },
    { label: 'Total lapses', value: s.totalLapses, sub: 'times a card was forgotten' },
    { label: 'Reviews (30d)', value: s.reviewsInWindow, sub: 'reviews in the last 30 days' },
    { label: 'Reviews this week', value: s.reviewsThisWeek, sub: 'reviews in the last 7 days' },
    { label: 'Retention (30d)', value: pct(s.retention), sub: 'reviews rated Good or better' },
    { label: 'Lapse rate (30d)', value: pct(s.lapseRate), sub: 'reviews rated Again' },
    { label: 'Unassigned notes', value: s.unassignedNotes, sub: 'notes with no subject' },
    { label: 'Notes without cards', value: s.notesWithoutCards, sub: 'no topic checks yet' },
  ]

  return (
    <PageShell title="Dashboard" subtitle={`Signed in as ${user?.email}`}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Review activity — last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap columns={columns} />
        </CardContent>
      </Card>

      {/* Featured: today's actionable numbers */}
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

      {/* All scalar stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {scalars.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Due in the next 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <DueForecast days={s.dueForecast} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cards by state</CardTitle>
          </CardHeader>
          <CardContent>
            <StateBreakdown counts={s.stateCounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <HardestCards cards={s.hardestCards} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By subject</CardTitle>
          </CardHeader>
          <CardContent>
            <SubjectRollup rows={s.subjectRollup} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
