// Value constants for the dashboard feature, kept separate from the type definitions
// (types.ts) and the helpers/components that consume them.

// Intensity scale — the single source the HeatmapLevelT union derives from (see types.ts)
// and the heatmap legend renders.
export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const

// `bg-heat-*` utility class per level (defined in globals.css @theme). Literal strings so
// Tailwind's scanner emits them — a `bg-heat-${level}` template would not be detected.
// Index = HeatmapLevelT.
export const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

// MS_PER_DAY + APP_TIME_ZONE moved to src/lib/utils/date.ts (shared on review-events' 2nd use).

// FSRS card states (ts-fsrs State enum). Index = topic_checks.state integer.
// 0 New · 1 Learning · 2 Review · 3 Relearning. Drives the state-breakdown stat.
export const FSRS_STATE_LABELS = ['New', 'Learning', 'Review', 'Relearning'] as const

// A card is "mature" once FSRS stability (≈ days until recall drops to 90%) crosses this.
// 21d is the conventional Anki maturity line — first-pass bucket, re-tune against real data.
export const MATURE_STABILITY_DAYS = 21

// Rolling window (days) for retention / lapse-rate / review-volume stats.
export const STATS_WINDOW_DAYS = 30

// Forecast horizon (days, inclusive of today) for the upcoming-due bar chart.
export const FORECAST_DAYS = 7

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
