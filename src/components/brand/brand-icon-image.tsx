import { BRAND_DARK } from '@/components/brand/brand-colors'
import { buildBrandDots, VIEWBOX } from '@/components/brand/brand-mark-dots'

// Shared element for the installable home-screen icons (PWA manifest + apple-touch). Distinct from
// app/icon.tsx (the favicon: transparent, edge-to-edge): these may be masked to a circle by the OS,
// so the mark is inset into the maskable safe zone and the background is filled. One renderer keeps
// every size pixel-identical and tracking the same brand-mark-dots geometry as the favicon/logo.
export function brandIconElement(px: number) {
  // The mark fills ~78% of the canvas; the remaining margin is the maskable safe zone a circular
  // mask can crop without clipping the dots.
  const markH = Math.round(px * 0.78)
  const markW = Math.round((markH * VIEWBOX.width) / VIEWBOX.height)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_DARK,
      }}
    >
      <svg width={markW} height={markH} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}>
        {buildBrandDots().map((d) => (
          <circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />
        ))}
      </svg>
    </div>
  )
}
