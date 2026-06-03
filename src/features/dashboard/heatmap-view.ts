import type { HeatmapCellT } from '@/features/dashboard/types'

// Geometry for the contribution grid. The grid itself is fluid — columns are `1fr` tracks that
// grow with the container, and an `aspect-ratio` keeps the 7×N lattice square (see
// activity-heatmap.tsx). CELL is the fixed px size used only by the static legend swatches.
export const CELL = 11 // px square (legend swatch only)
export const GAP = 2 // px between cells

// Tooltip copy for a cell: "3 reviews · Wed, Jun 3, 2025" (UTC, matching the date keys).
export function formatCellLabel(cell: HeatmapCellT): string {
  if (!cell.date) return ''
  const when = new Date(`${cell.date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const reviews =
    cell.count === 0 ? 'No reviews' : `${cell.count} review${cell.count === 1 ? '' : 's'}`
  return `${reviews} · ${when}`
}
