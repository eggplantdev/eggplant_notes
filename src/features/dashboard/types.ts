// Dashboard data + heatmap shape contracts. Feature-local shared types, consumed by the
// matrix builder, the page, and the heatmap component — kept out of the component files per
// the "components export only the component / shared types live in their own file" rule.
//
// DashboardDataT is the contract between the data layer (data.ts) and the UI; S-03 wired it
// to real per-user queries over `topic_checks` / `review_events` without changing this shape.

import { HEAT_LEVELS } from '@/features/dashboard/constants'
import type { ActivityDayT } from '@/types/activity'

// Level type derived from the HEAT_LEVELS const in constants.ts (its single source).
export type HeatmapLevelT = (typeof HEAT_LEVELS)[number]

export type DashboardDataT = {
  dueToday: number
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
  state: number
  due_at: string
  stability: number
  lapses: number
}
export type NoteStatRowT = { id: string; title: string | null; subject_id: string | null }
export type RatingStatRowT = { rating: number; reviewed_at: string }

// Counts of cards in each FSRS state (index = FSRS_STATE_LABELS index).
export type StateCountsT = { new: number; learning: number; review: number; relearning: number }

// One day of the upcoming-due forecast. `date` is ISO YYYY-MM-DD; day 0 folds in overdue.
export type DueForecastDayT = { date: string; count: number }

// A frequently-failed card, for the "needs attention" list. Links to its source note.
export type HardestCardT = {
  id: string
  prompt: string
  noteId: string
  noteTitle: string
  lapses: number
  stability: number
}

// Per-subject rollup row. `id`/`title` are null for the synthetic "No subject" bucket.
export type SubjectRollupT = {
  id: string | null
  title: string
  notes: number
  cards: number
  due: number
}

export type DashboardStatsT = {
  totalCards: number
  totalNotes: number
  totalSubjects: number
  stateCounts: StateCountsT
  overdue: number
  dueForecast: DueForecastDayT[]
  matureCards: number
  youngCards: number
  totalLapses: number
  reviewsInWindow: number
  reviewsThisWeek: number
  retention: number | null // fraction 0–1 of reviews rated ≥3 in the window; null if none
  lapseRate: number | null // fraction 0–1 of reviews rated 1 (Again) in the window
  longestStreak: number
  hardestCards: HardestCardT[]
  subjectRollup: SubjectRollupT[]
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
