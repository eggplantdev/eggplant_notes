'use client'

import { useRef } from 'react'

import { HEAT_BG, HEAT_LEVELS } from '@/features/dashboard/constants'
import { HeatmapCell } from '@/features/dashboard/heatmap-cell'
import { HeatmapTooltip } from '@/features/dashboard/heatmap-tooltip'
import { CELL, formatCellLabel, GAP } from '@/features/dashboard/heatmap-view'
import type { HeatmapCellT, HeatmapColumnT } from '@/features/dashboard/types'
import { cn } from '@/lib/utils'

type PropsT = { columns: HeatmapColumnT[] }

// Composes the contribution grid (HeatmapCell per day), the month labels, the legend, and a
// single shared HeatmapTooltip. Hover writes text/position to the tooltip imperatively via a
// ref, so moving across the ~371 cells never re-renders the grid.
export function ActivityHeatmap({ columns }: PropsT) {
  const tipRef = useRef<HTMLDivElement>(null)

  const showTip = (cell: HeatmapCellT, e: React.MouseEvent) => {
    const tip = tipRef.current
    if (!tip || !cell.date) return
    const r = e.currentTarget.getBoundingClientRect()
    tip.textContent = formatCellLabel(cell)
    tip.style.left = `${r.left + r.width / 2}px`
    tip.style.top = `${r.top - 4}px` // 4px gap above the cell (tooltip is lifted by -translate-y-full)
    tip.style.opacity = '1'
  }
  const hideTip = () => {
    if (tipRef.current) tipRef.current.style.opacity = '0'
  }

  const cols = columns.length

  return (
    <div className="w-full pb-1">
      {/* month labels — share the grid's column tracks so they stay aligned as cells grow; text
          overflows rightward into following tracks like GitHub */}
      <div
        className="text-muted-foreground text-3xs mb-1.5 grid uppercase"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `${GAP}px` }}
        aria-hidden
      >
        {columns.map((col, i) => (
          <span key={i} className="relative block overflow-visible whitespace-nowrap">
            {col.monthLabel}
          </span>
        ))}
      </div>

      <div
        role="img"
        aria-label="Review activity heatmap for the last 12 months"
        className="grid grid-flow-col"
        style={{
          // Fluid lattice: 7 fixed rows, N equal-width columns that grow with the container.
          // aspect-ratio (cols : 7) drives the height so each cell stays square at any width.
          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
          gridAutoColumns: 'minmax(0, 1fr)',
          gap: `${GAP}px`,
          aspectRatio: `${cols} / 7`,
        }}
      >
        {columns.map((col, ci) =>
          col.cells.map((cell, ri) => (
            <HeatmapCell key={`${ci}-${ri}`} cell={cell} onEnter={showTip} onLeave={hideTip} />
          )),
        )}
      </div>

      <div className="text-muted-foreground text-2xs mt-3 flex items-center gap-1">
        Less
        {HEAT_LEVELS.map((lvl) => (
          <span
            key={lvl}
            className={cn('inline-block rounded-xs', HEAT_BG[lvl])}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        More
      </div>

      <HeatmapTooltip ref={tipRef} />
    </div>
  )
}
