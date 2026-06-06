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

  // Compact tiles flanking the review panel: today's actionable numbers + the 30-day quality
  // pair. Rendered as a 2×2 grid of small StatCards. Cull a line to drop a tile.
  const tiles = [
    { label: 'Due today', value: dueToday, sub: 'memory cards ready to review' },
    { label: 'Overdue', value: s.overdue, sub: 'cards past their due date' },
    { label: 'Reviews (30d)', value: s.reviewsInWindow, sub: 'reviews in the last 30 days' },
    { label: 'Retention (30d)', value: pct(s.retention), sub: 'reviews rated Good or better' },
  ]

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Signed in as ${user?.email}`}
      actions={
        <div className="flex items-center gap-2">
          <ButtonLink href="/notes/new">New note</ButtonLink>
          <ButtonLink href="/memory-cards/new" variant="outline">
            New card
          </ButtonLink>
        </div>
      }
    >
      {/* Card-less hero stat: borrows the StatCard label/value type scale without the chrome. */}
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Current streak
        </p>
        <p className="text-foreground mt-1 flex items-baseline gap-2 text-4xl font-bold">
          <span>🔥</span>
          <span className="tabular-nums">{currentStreak}</span>
          <span className="text-muted-foreground text-base font-medium">
            {currentStreak === 1 ? 'day' : 'days'} hitting your daily goal
          </span>
        </p>
      </div>

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
        <ActivityHeatmap columns={columns} variant="neon-cyan" />
      </TitledCard>
      {/* Review session beside its key numbers — stacked on small screens, side-by-side on lg. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ReviewPanel card={card} goal={dailyGoal} />
        <div className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <StatCard key={tile.label} {...tile} compact />
          ))}
        </div>
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
