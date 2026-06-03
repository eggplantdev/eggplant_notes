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
