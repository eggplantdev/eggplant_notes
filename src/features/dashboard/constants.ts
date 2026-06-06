// Intensity scale — single source the HeatmapLevelT union derives from (types.ts).
export const HEAT_LEVELS = [0, 1, 2, 3, 4] as const

// Per-level `bg`/`text`/`glow` classes (index = HeatmapLevelT). All LITERAL — Tailwind's scanner
// can't emit a `bg-heat-${level}` template. `text` sets currentColor so glow blooms in the level's own hue.
export type HeatRampT = {
  bg: readonly [string, string, string, string, string]
  text: readonly [string, string, string, string, string]
  glow: readonly [string, string, string, string, string]
}

// To add a ramp: add it here, its `--heat-*` tokens + `@theme` aliases in globals.css, then set DEFAULT_HEAT_VARIANT.
export const HEAT_VARIANTS = {
  grayscale: {
    bg: ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'],
    text: ['', '', '', 'text-heat-4', 'text-heat-4'],
    glow: ['', '', '', 'heat-glow-sm', 'heat-glow-md'],
  },
  'neon-cyan': {
    bg: ['bg-heat-cyan-0', 'bg-heat-cyan-1', 'bg-heat-cyan-2', 'bg-heat-cyan-3', 'bg-heat-cyan-4'],
    text: ['', 'text-heat-cyan-1', 'text-heat-cyan-2', 'text-heat-cyan-3', 'text-heat-cyan-4'],
    glow: ['', 'heat-glow-sm', 'heat-glow-sm', 'heat-glow-md', 'heat-glow-lg'],
  },
} as const satisfies Record<string, HeatRampT>

export type HeatVariantT = keyof typeof HEAT_VARIANTS

export const DEFAULT_HEAT_VARIANT: HeatVariantT = 'neon-cyan'

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
