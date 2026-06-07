import type { HeatRampT } from '@/features/dashboard/constants'
import type { HeatmapCellT } from '@/features/dashboard/types'
import { cn } from '@/lib/utils'

type PropsT = {
  cell: HeatmapCellT
  ramp: HeatRampT
  onEnter: (cell: HeatmapCellT, e: React.MouseEvent) => void
  onLeave: () => void
}

// Padding cells (no date) render transparent and inert (no hover/tooltip).
export function HeatmapCell({ cell, ramp, onEnter, onLeave }: PropsT) {
  return (
    <div
      onMouseEnter={(e) => onEnter(cell, e)}
      onMouseLeave={onLeave}
      className={cn(
        'rounded-xs',
        cell.date
          ? cn(
              ramp.bg[cell.level],
              ramp.text[cell.level],
              ramp.glow[cell.level],
              'hover:outline-foreground outline-offset-1 hover:outline',
            )
          : 'bg-transparent',
      )}
    />
  )
}
