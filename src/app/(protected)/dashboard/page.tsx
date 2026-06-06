import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { ActivityHeatmap } from '@/features/dashboard/activity-heatmap'
import { buildHeatmapMatrix } from '@/features/dashboard/build-heatmap-matrix'
import { GoalProgressBar } from '@/components/ui/goal-progress-bar'
import { HardestCards } from '@/features/dashboard/hardest-cards'
import { StatCard } from '@/features/dashboard/stat-card'
import { TitledCard } from '@/components/ui/titled-card'
import { ReviewPanel } from '@/features/review/review-panel'
import { APP_TIME_ZONE, todayInZone } from '@/lib/utils'
import { getDashboardPageData } from './loader'

// Format a 0–1 fraction as a whole-percent string; em-dash when there's no data yet.
const pct = (f: number | null) => (f === null ? '—' : `${Math.round(f * 100)}%`)

export default async function DashboardPage() {
  // One route-level fan-out: getDashboardPageData (./loader) composes every read this page
  // needs in a single Promise.all and does the cross-feature join.
  const {
    user,
    stats: s,
    activity,
    dueToday,
    reviewedToday,
    currentStreak,
    dailyGoal,
    card,
  } = await getDashboardPageData()

  const columns = buildHeatmapMatrix(activity, {
    today: todayInZone(APP_TIME_ZONE),
    weeks: 53,
  })

  // Scalar stats rendered as a uniform StatCard grid. Cull a line to drop the card.
  const scalars = [
    { label: 'Longest streak', value: s.longestStreak, sub: 'best consecutive-day run' },
    { label: 'Overdue', value: s.overdue, sub: 'cards past their due date' },
    { label: 'Reviews (30d)', value: s.reviewsInWindow, sub: 'reviews in the last 30 days' },
    { label: 'Retention (30d)', value: pct(s.retention), sub: 'reviews rated Good or better' },
  ]

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Signed in as ${user?.email}`}
      actions={<ButtonLink href="/notes/new">New note</ButtonLink>}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Flip variant to switch palettes: 'aurora' | 'fuchsia' | 'mono' | 'white'. */}
        <GoalProgressBar
          label="Today's progress"
          reviewed={reviewedToday}
          goal={dailyGoal}
          variant="aurora"
          goalHitText="Daily goal hit 🏄"
        />
        <GoalProgressBar
          label="This week's progress"
          reviewed={s.reviewsThisWeek}
          goal={dailyGoal * 7}
          variant="aurora"
          goalHitText="Weekly goal hit 🚀"
        />
      </div>

      <TitledCard title="Review activity — last 12 months" className="w-full">
        <ActivityHeatmap columns={columns} />
      </TitledCard>

      <div className="mx-auto w-full max-w-2xl">
        <ReviewPanel card={card} goal={dailyGoal} />
      </div>

      {/* Featured: today's actionable numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Due today" value={dueToday} sub="memory cards ready to review" />
        <StatCard
          label="Current streak"
          value={
            <>
              🔥 {currentStreak}{' '}
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

      {/* Surfaced only once there's a real backlog of lapsing cards — a single struggler isn't
          worth a callout. */}
      {s.hardestCards.length > 1 && (
        <TitledCard title="Needs attention">
          <HardestCards cards={s.hardestCards} />
        </TitledCard>
      )}
    </PageShell>
  )
}
