import { HEAT_BG } from '@/features/dashboard/constants'
import type { HeatmapCellT } from '@/features/dashboard/types'
import { cn } from '@/lib/utils'

type PropsT = {
  cell: HeatmapCellT
  onEnter: (cell: HeatmapCellT, e: React.MouseEvent) => void
  onLeave: () => void
}

// One day square in the contribution grid. Sized by the parent grid's track; color is its
// intensity level. Padding cells (no date) render transparent and inert (no hover/tooltip).
export function HeatmapCell({ cell, onEnter, onLeave }: PropsT) {
  return (
    <div
      onMouseEnter={(e) => onEnter(cell, e)}
      onMouseLeave={onLeave}
      className={cn(
        'rounded-xs',
        cell.date
          ? `${HEAT_BG[cell.level]} hover:outline-foreground outline-offset-1 hover:outline`
          : 'bg-transparent',
      )}
    />
  )
}
