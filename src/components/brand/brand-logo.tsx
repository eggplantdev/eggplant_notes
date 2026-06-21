// The app's brand mark: the hand-drawn aubergine dot grid, coloured top→bottom along the brand neon
// ramp, with a soft glow and a −3° left lean. Geometry (grid, ramp, dot positions) is shared with the
// favicon via brand-mark-dots — this file owns the on-screen rendering (glow layer + lean).

import { cn } from '@/lib/utils'

import { buildBrandDots, DOT_R, VIEWBOX } from './brand-mark-dots'

const GLOW = 0.9 // 0..1 bloom intensity

export function BrandLogo({ className }: { className?: string }) {
  const dots = buildBrandDots().map((d) => (
    <circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />
  ))

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      // overflow-visible: the glow blur blooms past the viewBox; the svg's default overflow:hidden
      // would clip it at the box edge.
      className={cn('overflow-visible', className)}
      aria-hidden
    >
      {/* Glow is one blur pass over a cloned dot layer behind the sharp dots — not a per-dot filter,
          which would re-rasterise every dot on each paint. */}
      <defs>
        <filter id="brand-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={GLOW * DOT_R * 1.8} />
        </filter>
      </defs>
      <g filter="url(#brand-glow)" opacity={Math.min(1, 0.55 + GLOW * 0.45)}>
        {dots}
      </g>
      <g>{dots}</g>
    </svg>
  )
}
