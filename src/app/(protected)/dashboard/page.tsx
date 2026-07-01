import { PageShell } from '@/components/layout/page-shell'
import { ActivityHeatmap } from '@/features/dashboard/components/activity-heatmap'
import { buildHeatmapMatrix } from '@/features/dashboard/build-heatmap-matrix'
import { GoalProgressBar } from '@/components/ui/goal-progress-bar'
import { SectionLabel } from '@/components/ui/section-label'
import { HardestCards } from '@/features/dashboard/components/hardest-cards'
import { StatCard } from '@/features/dashboard/components/stat-card'
import { TitledCard } from '@/components/ui/titled-card'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'
import { getDashboardData } from '@/features/dashboard/data'
import { getCurrentUser } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { WelcomeDialogServer } from '@/features/dashboard/components/welcome-dialog-server'

// em-dash when there's no data yet (null fraction).
const percentage = (fraction: number | null) =>
  fraction === null ? '—' : `${Math.round(fraction * 100)}%`

export default async function DashboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getDashboardData()])
  const { stats, activity, dueToday, reviewedToday, currentStreak, dailyGoal } = data

  const columns = buildHeatmapMatrix(activity, {
    today: todayInZone(APP_TIME_ZONE),
    weeks: 53,
  })

  // Rendered as a 2×2 grid; cull a line to drop a tile.
  const tiles = [
    { label: 'Due today', value: dueToday, sub: 'memory cards ready to review' },
    { label: 'Overdue', value: stats.overdue, sub: 'cards past their due date' },
    { label: 'Reviews (30d)', value: stats.reviewsInWindow, sub: 'reviews in the last 30 days' },
    {
      label: 'Retention (30d)',
      value: percentage(stats.retention),
      sub: 'reviews rated Good or better',
    },
  ]

  return (
    <PageShell title="Dashboard" subtitle={`Signed in as ${user?.email}`}>
      <Suspense>{<WelcomeDialogServer />}</Suspense>
      {/* Match the memory-cards page's bigger, even section spacing (PageShell's own gap is the default). */}
      <div className="flex flex-col gap-12">
        {/* Card-less hero stat: StatCard's type scale without the chrome. */}
        <div>
          <SectionLabel>Current streak</SectionLabel>
          <p className="text-foreground mt-1 flex items-baseline gap-2 text-4xl font-bold">
            <span>🔥</span>
            <span className="tabular-nums">{currentStreak}</span>
            <span className="text-muted-foreground text-base font-medium">
              {currentStreak === 1 ? 'day' : 'days'} hitting your daily goal
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GoalProgressBar
            label="Today's progress"
            reviewed={reviewedToday}
            goal={dailyGoal}
            variant="aurora"
            goalHitText="Daily goal hit 🏄"
          />
          <GoalProgressBar
            label="This week's progress"
            reviewed={stats.reviewsThisWeek}
            goal={dailyGoal * 7}
            variant="aurora"
            goalHitText="Weekly goal hit 🚀"
          />
        </div>
        <TitledCard title="Review activity — last 12 months" className="w-full">
          <ActivityHeatmap columns={columns} variant="neon-cyan" />
        </TitledCard>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {tiles.map((tile) => (
            <StatCard key={tile.label} {...tile} compact />
          ))}
        </div>
      </div>
      <HardestCards cards={stats.hardestCards} />
    </PageShell>
  )
}
