import { HEAT_LEVELS } from '@/features/dashboard/constants'
import type { ActivityDayT } from '@/types/activity'

export type HeatmapLevelT = (typeof HEAT_LEVELS)[number]

export type DashboardDataT = {
  dueToday: number
  reviewedToday: number
  currentStreak: number
  activity: ActivityDayT[]
  stats: DashboardStatsT
}

// ── Expanded stats (all derived from existing columns; no schema change) ──────────────
// Structural row shapes the pure stats computation reads. Defined here (not imported from
// each feature's queries) so computeDashboardStats stays free of cross-feature type imports —
// the feature read helpers return rows that are structurally assignable to these.
export type CheckStatRowT = {
  id: string
  prompt: string
  note_id: string
  due_at: string
  stability: number
  lapses: number
}
export type NoteStatRowT = { id: string; title: string | null }
export type RatingStatRowT = { rating: number; reviewed_at: string }

// A frequently-failed card, for the "needs attention" list. Links to its source note.
export type HardestCardT = {
  id: string
  prompt: string
  noteId: string
  noteTitle: string
  lapses: number
  stability: number
}

export type DashboardStatsT = {
  overdue: number
  reviewsInWindow: number
  reviewsThisWeek: number
  retention: number | null // fraction 0–1 of reviews rated ≥3 in the window; null if none
  longestStreak: number
  hardestCards: HardestCardT[]
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
