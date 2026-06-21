'use client'

import { createContext, useContext } from 'react'

// The brand wordmark shown under the logo — shared by the splash lockup and the page's resting copy so
// they morph as one and can't drift apart.
export const WORDMARK = 'eggplant_notes'

// The brand intro's lifecycle, consumed by a page's lockup so it can hand its logo+wordmark off to the
// splash overlay. Portable across pages (landing, sign-in, …) — the provider owns the show, each page
// drops a <BrandIntroLockup> where the mark should land.
//   idle   — SSR + first client render; the lockup behaves as a normal mark (matches server HTML)
//   splash — full-screen veil owns a scaled-up scatter + wordmark; the page lockup is a hidden placeholder
//   morph  — lockup glides down to the page (layoutId) while the veil STAYS opaque, content still hidden
//   reveal — veil dissolves; page content fades up behind the settled lockup
//   done   — cleanup; the lockup is a plain settled mark (no layoutId/z lift to outlive the anim)
//   skip   — no veil (returning visitor this session, or reduced motion); the mark scatters in place
export type BrandIntroPhaseT = 'idle' | 'splash' | 'morph' | 'reveal' | 'done' | 'skip'

export const BrandIntroContext = createContext<BrandIntroPhaseT>('idle')

export function useBrandIntro() {
  return useContext(BrandIntroContext)
}
