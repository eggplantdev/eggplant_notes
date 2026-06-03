import type { HeatmapCellT } from '@/features/dashboard/types'

// Geometry for the contribution grid. Intentionally in px: this is fixed pixel-art (a dense
// 7×53 square lattice), where rem/% would let cells reflow and break weekday alignment.
export const CELL = 11 // px square
export const GAP = 2 // px between cells
export const PITCH = CELL + GAP // column/row stride

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
