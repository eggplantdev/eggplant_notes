import type { HeatmapCellT } from '@/features/dashboard/types'
import { formatFullDate } from '@/lib/utils/date'

// The grid itself is fluid (1fr tracks + aspect-ratio, see activity-heatmap.tsx); CELL is fixed px for the legend swatches only.
export const CELL = 11 // px square (legend swatch only)
export const GAP = 2 // px between cells

// Per-column floor on mobile: the grid claims max(100%, cols × this) so on a narrow phone it grows past
// the viewport (→ horizontal scroll, touch-sized cells) while staying fluid full-width on larger screens.
export const MIN_COL_WIDTH = 15 // px (cell + GAP)

// e.g. "3 reviews · Wed, Jun 3, 2025" — UTC, matching the date keys.
export function formatCellLabel(cell: HeatmapCellT): string {
  if (!cell.date) return ''
  const when = formatFullDate(cell.date)
  const reviews =
    cell.count === 0 ? 'No reviews' : `${cell.count} review${cell.count === 1 ? '' : 's'}`
  return `${reviews} · ${when}`
}
