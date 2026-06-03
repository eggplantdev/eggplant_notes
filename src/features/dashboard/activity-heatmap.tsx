'use client'

import { useState } from 'react'

import type { HeatmapCell, HeatmapColumn } from '@/features/dashboard/build-heatmap-matrix'
import { CELL, formatCellLabel, GAP, PITCH, type TipT } from '@/features/dashboard/heatmap-view'

type PropsT = { columns: HeatmapColumn[] }

// Pure presentation: renders a prebuilt matrix (cols = weeks, rows = weekdays) plus month
// labels and an intensity legend. Owns a single floating tooltip rather than one popover per
// cell. No data fetching — the server page sources data and passes serializable columns.
export function ActivityHeatmap({ columns }: PropsT) {
  const [tip, setTip] = useState<TipT | null>(null)

  const show = (cell: HeatmapCell, e: React.MouseEvent) => {
    if (!cell.date) return
    const r = e.currentTarget.getBoundingClientRect()
    setTip({ text: formatCellLabel(cell), x: r.left + r.width / 2, y: r.top })
  }

  return (
    <div className="w-full overflow-x-auto pb-1">
      {/* month labels — aligned to column pitch; text overflows rightward like GitHub */}
      <div className="text-muted-foreground mb-1.5 flex text-[0.5625rem] uppercase" aria-hidden>
        {columns.map((col, i) => (
          <span
            key={i}
            className="relative block shrink-0 overflow-visible whitespace-nowrap"
            style={{ width: PITCH }}
          >
            {col.monthLabel}
          </span>
        ))}
      </div>

      <div
        role="img"
        aria-label="Review activity heatmap for the last 12 months"
        className="grid grid-flow-col"
        style={{
          gridTemplateRows: `repeat(7, ${CELL}px)`,
          gridAutoColumns: `${CELL}px`,
          gap: `${GAP}px`,
        }}
      >
        {columns.map((col, ci) =>
          col.cells.map((cell, ri) => (
            <div
              key={`${ci}-${ri}`}
              onMouseEnter={(e) => show(cell, e)}
              onMouseLeave={() => setTip(null)}
              className={
                cell.date
                  ? 'rounded-[0.125rem] outline-offset-1 hover:outline hover:outline-[var(--foreground)]'
                  : 'rounded-[0.125rem]'
              }
              style={{
                backgroundColor: cell.date ? `var(--heat-${cell.level})` : 'transparent',
              }}
            />
          )),
        )}
      </div>

      <div className="text-muted-foreground mt-3 flex items-center gap-1 text-[0.6875rem]">
        Less
        {[0, 1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="inline-block rounded-[0.125rem]"
            style={{ width: CELL, height: CELL, backgroundColor: `var(--heat-${lvl})` }}
          />
        ))}
        More
      </div>

      {tip && (
        <div
          className="bg-popover text-popover-foreground border-border pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[120%] rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{ left: tip.x, top: tip.y }}
          role="status"
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
