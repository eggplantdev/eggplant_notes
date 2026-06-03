// Value constants for the dashboard feature, kept separate from the type definitions
// (types.ts) and the helpers/components that consume them.

// Intensity scale — the single source the HeatmapLevelT union derives from (see types.ts)
// and the heatmap legend renders.
export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const

// `bg-heat-*` utility class per level (defined in globals.css @theme). Literal strings so
// Tailwind's scanner emits them — a `bg-heat-${level}` template would not be detected.
// Index = HeatmapLevelT.
export const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

export const MS_PER_DAY = 86_400_000

// The single calendar zone the app buckets review activity / streak / heatmap "today" by.
// This is a solo personal tool, so one fixed zone is correct and simplest. Vercel functions
// run in UTC, so a naive `::date` / `new Date()` would bucket a late-night (local) review
// into the next UTC day — bucketing in this zone keeps "today" matching the user's clock.
export const APP_TIME_ZONE = 'Europe/Warsaw'

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
