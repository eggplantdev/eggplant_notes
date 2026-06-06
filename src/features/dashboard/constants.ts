// Value constants for the dashboard feature, kept separate from the type definitions
// (types.ts) and the helpers/components that consume them.

// Intensity scale — the single source the HeatmapLevelT union derives from (see types.ts)
// and the heatmap legend renders.
export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const

// `bg-heat-*` utility class per level (defined in globals.css @theme). Literal strings so
// Tailwind's scanner emits them — a `bg-heat-${level}` template would not be detected.
// Index = HeatmapLevelT.
export const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

// Neon-style glow per level (globals.css @utility), empty for the dim levels so only the
// brightest (most-active) cells glow. Literal strings for the same Tailwind-scanner reason as
// HEAT_BG. Index = HeatmapLevelT.
export const HEAT_GLOW = ['', '', '', 'heat-glow', 'heat-glow-strong'] as const

// MS_PER_DAY + APP_TIME_ZONE moved to src/lib/utils/date.ts (shared on review-events' 2nd use).

// Rolling window (days) for retention / lapse-rate / review-volume stats.
export const STATS_WINDOW_DAYS = 30

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
