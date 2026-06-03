// Dashboard data + heatmap shape contracts. Feature-local shared types, consumed by the
// matrix builder, the page, and the heatmap component — kept out of the component files per
// the "components export only the component / shared types live in their own file" rule.
//
// The DashboardDataT shape matches what the real queries will return post-S-03 (the recall
// loop writes `review_events`); the UI shell fills it with dummy data, so wiring is a body
// swap in data.ts, not a type or component change.

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
