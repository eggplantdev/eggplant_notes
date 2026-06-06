// Value constants for the dashboard feature, kept separate from the type definitions
// (types.ts) and the helpers/components that consume them.

// Intensity scale — the single source the HeatmapLevelT union derives from (see types.ts)
// and the heatmap legend renders.
export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const

// A heatmap colour ramp: per-level (index = HeatmapLevelT) `bg`/`text`/`glow` class strings.
// All LITERAL — Tailwind's scanner can't emit a `bg-heat-${level}` template, so every class is
// spelled out. `text` sets the cell's currentColor so the glow utilities bloom in that level's
// own hue; tokens/utilities live in globals.css.
export type HeatRampT = {
  bg: readonly [string, string, string, string, string]
  text: readonly [string, string, string, string, string]
  glow: readonly [string, string, string, string, string]
}

// Selectable heatmap ramps. To add one: add a ramp here, its `--heat-*` tokens + `@theme` aliases
// in globals.css, then flip DEFAULT_HEAT_VARIANT or pass `variant` to <ActivityHeatmap>.
export const HEAT_VARIANTS = {
  // The original neutral grayscale ramp; white bloom on the two busiest levels.
  grayscale: {
    bg: ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'],
    text: ['', '', '', 'text-heat-4', 'text-heat-4'],
    glow: ['', '', '', 'heat-glow-sm', 'heat-glow-md'],
  },
  // Neon cyan: dark → blazing cyan, glow rising with activity, each cell blooming in its own shade.
  'neon-cyan': {
    bg: ['bg-heat-cyan-0', 'bg-heat-cyan-1', 'bg-heat-cyan-2', 'bg-heat-cyan-3', 'bg-heat-cyan-4'],
    text: ['', 'text-heat-cyan-1', 'text-heat-cyan-2', 'text-heat-cyan-3', 'text-heat-cyan-4'],
    glow: ['', 'heat-glow-sm', 'heat-glow-sm', 'heat-glow-md', 'heat-glow-lg'],
  },
} as const satisfies Record<string, HeatRampT>

export type HeatVariantT = keyof typeof HEAT_VARIANTS

export const DEFAULT_HEAT_VARIANT: HeatVariantT = 'neon-cyan'

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
