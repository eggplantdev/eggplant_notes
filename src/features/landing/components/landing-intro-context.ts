'use client'

import { createContext, useContext } from 'react'

// The brand wordmark shown under the logo — shared by the splash lockup and the hero so they morph
// as one and can't drift apart.
export const WORDMARK = 'eggplant_notes'

// The landing intro's lifecycle, consumed by the hero so it can hand its logo off to the splash overlay.
//   idle   — SSR + first client render; hero behaves as a normal page (matches server HTML, no mismatch)
//   splash — full-screen veil owns a scaled-up scatter + wordmark; the hero lockup is a hidden placeholder
//   morph  — lockup glides down to the hero (layoutId) while the veil STAYS opaque, so page content is
//            still hidden until the animation lands
//   reveal — veil dissolves; page content (sections + hero copy) fades up behind the settled lockup
//   done   — cleanup; hero lockup is a plain settled mark (no layoutId/z lift to outlive the anim)
//   skip   — no veil (returning visitor this session, or reduced motion); hero scatters in place
export type LandingIntroPhaseT = 'idle' | 'splash' | 'morph' | 'reveal' | 'done' | 'skip'

export const LandingIntroContext = createContext<LandingIntroPhaseT>('idle')

export function useLandingIntro() {
  return useContext(LandingIntroContext)
}
