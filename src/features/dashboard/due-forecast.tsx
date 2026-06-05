import type { DueForecastDayT } from '@/features/dashboard/types'
import { formatWeekdayShort } from '@/lib/utils/date'

type PropsT = { days: DueForecastDayT[] }

// Upcoming-due bar chart: one bar per day, day 0 ("Today") folding in overdue cards. Bar
// heights are data-driven so they use an inline `height` % (same exception the heatmap takes
// for its dynamic grid template) — there is no static utility for a runtime-computed height.
export function DueForecast({ days }: PropsT) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className="flex h-32 items-end gap-2">
      {days.map((d, i) => {
        const label = i === 0 ? 'Today' : formatWeekdayShort(d.date)
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs tabular-nums">{d.count}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="bg-primary w-full rounded-t-sm transition-all"
                style={{ height: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
