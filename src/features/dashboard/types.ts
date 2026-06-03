// Dashboard data + heatmap shape contracts. Feature-local shared types, consumed by the
// matrix builder, the page, and the heatmap component — kept out of the component files per
// the "components export only the component / shared types live in their own file" rule.
//
// DashboardDataT is the contract between the data layer (data.ts) and the UI; S-03 wired it
// to real per-user queries over `topic_checks` / `review_events` without changing this shape.

import { HEAT_LEVELS } from '@/features/dashboard/constants'

// Level type derived from the HEAT_LEVELS const in constants.ts (its single source).
export type HeatmapLevelT = (typeof HEAT_LEVELS)[number]

// One calendar day of review activity. `date` is an ISO `YYYY-MM-DD` string (UTC).
export type ActivityDayT = { date: string; count: number }

export type DashboardDataT = {
  dueToday: number
  currentStreak: number
  activity: ActivityDayT[]
}

// One grid cell. `date` is null for padding (outside the window / after today).
export type HeatmapCellT = {
  date: string | null
  count: number
  level: HeatmapLevelT
}

// One week column: 7 cells (index = weekday, 0=Sun … 6=Sat) + an optional month label
// (set on the first column of a new month; drives the labels above the grid).
export type HeatmapColumnT = {
  cells: HeatmapCellT[]
  monthLabel: string | null
}
