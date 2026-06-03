import type { ActivityDay } from '@/features/dashboard/types'

// GitHub-style contribution grid layout. Columns = weeks (oldest left → newest right),
// each column has 7 cells indexed by weekday (0 = Sunday … 6 = Saturday). Days outside
// the trailing window or after `today` are padding (`date: null`). This pure layout is
// reused unchanged when real `review_events` aggregates replace the dummy data.

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

export type HeatmapCell = {
  date: string | null // YYYY-MM-DD, or null for padding (outside range / future)
  count: number
  level: HeatmapLevel
}

export type HeatmapColumn = {
  cells: HeatmapCell[] // length 7, index = weekday (0=Sun … 6=Sat)
  // Month abbreviation ("Jun"), set on the first column whose representative day starts a
  // new month; null otherwise. Drives the labels rendered above the grid.
  monthLabel: string | null
}

const MS_PER_DAY = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// All date math is in UTC to keep `YYYY-MM-DD` keys stable regardless of the runtime TZ.
function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function toISODate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// Counts map to levels by fixed thresholds. First-pass buckets — re-tune against the real
// review-count distribution when the data layer lands (noted in the design spec).
export function countToLevel(count: number): HeatmapLevel {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 9) return 3
  return 4
}

export function buildHeatmapMatrix(
  activity: ActivityDay[],
  opts: { today: Date; weeks?: number },
): HeatmapColumn[] {
  const weeks = opts.weeks ?? 53
  const counts = new Map(activity.map((a) => [a.date, a.count]))

  const todayMs = utcMidnight(opts.today)
  const todayWeekday = new Date(todayMs).getUTCDay()
  // Sunday of the current (rightmost) week, then back up to the first column's Sunday.
  const lastColumnSunday = todayMs - todayWeekday * MS_PER_DAY
  const firstColumnSunday = lastColumnSunday - (weeks - 1) * 7 * MS_PER_DAY

  const columns: HeatmapColumn[] = []
  let prevMonth = -1

  for (let c = 0; c < weeks; c++) {
    const columnSunday = firstColumnSunday + c * 7 * MS_PER_DAY
    const cells: HeatmapCell[] = []

    for (let weekday = 0; weekday < 7; weekday++) {
      const cellMs = columnSunday + weekday * MS_PER_DAY
      if (cellMs > todayMs) {
        cells.push({ date: null, count: 0, level: 0 })
        continue
      }
      const date = toISODate(cellMs)
      const count = counts.get(date) ?? 0
      cells.push({ date, count, level: countToLevel(count) })
    }

    // Label a column when its first day's month differs from the previous column's.
    const columnMonth = new Date(columnSunday).getUTCMonth()
    const monthLabel = columnMonth !== prevMonth ? MONTHS[columnMonth] : null
    prevMonth = columnMonth
    columns.push({ cells, monthLabel })
  }

  return columns
}
