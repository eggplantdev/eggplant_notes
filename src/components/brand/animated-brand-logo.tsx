'use client'

// Animated variant of <BrandLogo> for the marketing hero: the same dot grid, but each dot flies in
// from a scattered position and settles into place. Geometry/colours come from the shared
// brand-mark-dots source — this file only owns the entrance animation.
//
// `entrance={false}` renders the mark already settled (no scatter, glow at rest). The landing intro
// uses that for the hero copy it morphs the splash logo into, so the mark doesn't re-scatter on handoff.

import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { buildBrandDots, DOT_R, VIEWBOX } from './brand-mark-dots'

const GLOW = 0.9 // 0..1 bloom intensity — matches the static BrandLogo
const REST_BLUR = GLOW * DOT_R * 1.8 // resting glow blur, matching the static BrandLogo
const FLIGHT_BLUR = REST_BLUR * 3.2 // bigger bloom while the dots are still flying in

// Deterministic [0,1) hash so server and client compute the SAME scatter — a Math.random() scatter
// would differ between SSR and hydration and trip a mismatch on the initial transform.
function rand(seed: number) {
  const x = Math.sin(seed * 99.13) * 43758.5453
  return x - Math.floor(x)
}

// Where dot `i` starts: pushed out from its final spot along a hashed angle by a large random
// distance, so the grid begins as a loose cloud and converges inward.
function scatter(i: number, cx: number, cy: number) {
  const angle = rand(i + 1) * Math.PI * 2
  const dist = (0.7 + rand(i * 2 + 5) * 0.9) * VIEWBOX.width
  return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist }
}

type AnimatedBrandLogoPropsT = {
  className?: string
  // false → render settled, no entrance animation (the intro morphs into this state).
  entrance?: boolean
}

export function AnimatedBrandLogo({ className, entrance = true }: AnimatedBrandLogoPropsT) {
  const reduced = useReducedMotion()
  // Unique per instance — a fixed id collides with the nav's BrandLogo and with a second copy of this
  // logo on screen (the intro renders splash + hero copies), and url(#id) resolves to the first match.
  const filterId = useId()
  const animate = entrance && !reduced
  const dots = buildBrandDots()

  // One layer of <motion.circle>s; rendered twice (blurred glow behind, sharp in front) with
  // identical motion props so both stay perfectly in sync through the flight.
  const renderDots = () =>
    dots.map((d, i) => {
      const from = scatter(i, d.cx, d.cy)
      // Stagger by a hashed delay + a gentle index ramp so dots don't all land at once. Larger
      // spacing = a slower, more drawn-out assembly.
      const delay = i * 0.03 + rand(i * 3 + 7) * 0.35
      return (
        <motion.circle
          key={`${d.cx}-${d.cy}`}
          r={d.r}
          fill={d.fill}
          initial={animate ? { cx: from.x, cy: from.y, scale: 0.2, opacity: 0 } : false}
          animate={{ cx: d.cx, cy: d.cy, scale: 1, opacity: 1 }}
          transition={
            animate
              ? {
                  // Softer spring (lower stiffness, more mass) — dots drift in and settle slowly.
                  cx: { type: 'spring', stiffness: 55, damping: 14, mass: 1.4, delay },
                  cy: { type: 'spring', stiffness: 55, damping: 14, mass: 1.4, delay },
                  scale: { type: 'spring', stiffness: 70, damping: 13, mass: 1.2, delay },
                  opacity: { duration: 0.6, delay },
                }
              : { duration: 0 }
          }
        />
      )
    })

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      className={` ${className ?? ''}`}
      aria-hidden
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <motion.feGaussianBlur
            initial={animate ? { stdDeviation: FLIGHT_BLUR } : false}
            animate={{ stdDeviation: REST_BLUR }}
            transition={animate ? { duration: 2, ease: 'easeOut' } : { duration: 0 }}
          />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} opacity={Math.min(1, 0.55 + GLOW * 0.45)}>
        {renderDots()}
      </g>
      <g>{renderDots()}</g>
    </svg>
  )
}
