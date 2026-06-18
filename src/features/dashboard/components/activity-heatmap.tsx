'use client'

import { useCallback, useRef } from 'react'

import {
  DEFAULT_HEAT_VARIANT,
  HEAT_LEVELS,
  HEAT_VARIANTS,
  type HeatVariantT,
} from '@/features/dashboard/constants'
import { HeatmapCell } from '@/features/dashboard/components/heatmap-cell'
import { HeatmapTooltip } from '@/features/dashboard/components/heatmap-tooltip'
import { CELL, formatCellLabel, GAP, MIN_COL_WIDTH } from '@/features/dashboard/heatmap-view'
import type { HeatmapCellT, HeatmapColumnT } from '@/features/dashboard/types'
import { cn } from '@/lib/utils'

type PropsT = { columns: HeatmapColumnT[]; variant?: HeatVariantT }

// Hover writes the shared tooltip imperatively via a ref so moving across the ~371 cells never re-renders the grid.
export function ActivityHeatmap({ columns, variant = DEFAULT_HEAT_VARIANT }: PropsT) {
  const ramp = HEAT_VARIANTS[variant]
  const tipRef = useRef<HTMLDivElement>(null)

  const showTip = (cell: HeatmapCellT, e: React.MouseEvent) => {
    const tip = tipRef.current
    if (!tip || !cell.date) return
    const r = e.currentTarget.getBoundingClientRect()
    tip.textContent = formatCellLabel(cell)
    tip.style.left = `${r.left + r.width / 2}px`
    tip.style.top = `${r.top - 4}px`
    tip.style.opacity = '1'
  }
  const hideTip = () => {
    if (tipRef.current) tipRef.current.style.opacity = '0'
  }

  // Newest week is the rightmost column; land scrolled to the end so the current days show without a swipe on mobile.
  const scrollToEnd = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollLeft = node.scrollWidth
  }, [])

  const cols = columns.length
  // Floor the grid at cols × MIN_COL_WIDTH so it overflows (→ scroll) on narrow phones, stays fluid above.
  const minWidth = `max(100%, ${cols * MIN_COL_WIDTH}px)`

  return (
    <div className="w-full pb-1">
      {/* Touch-scrolls horizontally on mobile; fluid full-width on larger screens where 100% wins the max(). */}
      <div ref={scrollToEnd} className="-mx-1 overflow-x-auto px-1">
        <div style={{ width: minWidth }}>
          {/* Month labels share the grid's column tracks so they stay aligned as cells grow; text overflows rightward. */}
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
              // Fluid lattice: 7 fixed rows, N fluid columns; aspect-ratio (cols:7) keeps each cell square at any width.
              gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
              gridAutoColumns: 'minmax(0, 1fr)',
              gap: `${GAP}px`,
              aspectRatio: `${cols} / 7`,
            }}
          >
            {columns.map((col, ci) =>
              col.cells.map((cell, ri) => (
                <HeatmapCell
                  key={`${ci}-${ri}`}
                  cell={cell}
                  ramp={ramp}
                  onEnter={showTip}
                  onLeave={hideTip}
                />
              )),
            )}
          </div>
        </div>
      </div>

      <div className="text-muted-foreground text-2xs mt-3 flex items-center gap-1">
        <span>Less</span>
        {HEAT_LEVELS.map((lvl) => (
          <span
            key={lvl}
            className={cn('inline-block rounded-xs', ramp.bg[lvl])}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        <span>More (16+)</span>
      </div>

      <HeatmapTooltip ref={tipRef} />
    </div>
  )
}
