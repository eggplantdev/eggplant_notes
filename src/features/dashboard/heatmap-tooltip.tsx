import type { Ref } from 'react'

type PropsT = { ref: Ref<HTMLDivElement> }

// Single floating tooltip for the heatmap. Its text and position are written imperatively by
// the parent through the forwarded ref (no per-hover React state), so hovering across the
// grid never triggers a re-render.
export function HeatmapTooltip({ ref }: PropsT) {
  return (
    <div
      ref={ref}
      role="status"
      className="bg-popover text-popover-foreground border-border pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 shadow-lg transition-opacity"
    />
  )
}
