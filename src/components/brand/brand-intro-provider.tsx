'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { AnimatedBrandLogo } from './animated-brand-logo'
import { BrandIntroContext, WORDMARK, type BrandIntroPhaseT } from './brand-intro-context'
import { IntroWordmark, wordmarkDurationMs } from './intro-wordmark'

// The splash plays in sequence: dots scatter/assemble, THEN the wordmark types out, THEN a beat to
// read it before the lockup morphs into the page. Each stage is its own number so the reveal can't drift.
const SCATTER_MS = 3000 // dots fly in and settle (≈ slowest dot's staggered spring)
const READ_MS = 700 // pause after the wordmark finishes, before revealing the page
const INTRO_MS = SCATTER_MS + wordmarkDurationMs(WORDMARK) + READ_MS
// The lockup glides to the page while the veil stays opaque — content is hidden until it lands. A hair
// longer than the morph's own duration (1s) so it fully settles before the veil dissolves.
const MORPH_MS = 1100
// Veil dissolve — only AFTER the morph, so the page reveals once the animation is done, not during it.
const VEIL_FADE_S = 0.9
const VEIL_FADE_MS = VEIL_FADE_S * 1000
// One key for the whole tab session — sessionStorage clears on tab close.
const SEEN_KEY = 'eggplant-brand-intro-seen'

// Wraps a page to play the brand intro once and morph the splash lockup into that page's <BrandIntroLockup>.
// Children stay server-rendered (passed through), so a server-component page can use this client boundary.
export function BrandIntroProvider({ children }: { children: ReactNode }) {
  // Start 'idle' on both server and first client render so hydration matches; the effect then decides.
  const [phase, setPhase] = useState<BrandIntroPhaseT>('idle')

  useEffect(() => {
    // The mount-time transition is intentional, not an avoidable cascading render: we MUST render 'idle'
    // on the server + first client paint (reduced-motion and session state aren't knowable during SSR),
    // then decide the real phase here. Hence the rule disable below.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Once per tab session (sessionStorage clears on tab close → fresh tab/incognito replays). `?intro`
    // forces a replay (dev escape hatch). One shared key across pages — seeing it on `/` skips it on
    // `/sign-in` in the same session, which is the intent (it's the same brand intro).
    const forced = new URLSearchParams(window.location.search).has('intro')
    const seen = sessionStorage.getItem(SEEN_KEY)

    if (reduced || (seen && !forced)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe client decision, see above
      setPhase('skip')
      return
    }

    sessionStorage.setItem(SEEN_KEY, '1')
    setPhase('splash')
    // splash → morph (veil still opaque) → reveal (veil dissolves) → done (cleanup).
    const toMorph = setTimeout(() => setPhase('morph'), INTRO_MS)
    const toReveal = setTimeout(() => setPhase('reveal'), INTRO_MS + MORPH_MS)
    const toDone = setTimeout(() => setPhase('done'), INTRO_MS + MORPH_MS + VEIL_FADE_MS)
    return () => {
      clearTimeout(toMorph)
      clearTimeout(toReveal)
      clearTimeout(toDone)
    }
  }, [])

  // Lock scroll while the opaque veil is up — the page underneath shouldn't move during the show.
  useEffect(() => {
    if (phase !== 'splash' && phase !== 'morph') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [phase])

  return (
    <BrandIntroContext.Provider value={phase}>
      {children}

      {/* Plain veil over the whole page — stays opaque through splash AND morph (so content is hidden
          until the lockup lands), then dissolves on reveal so the page fades up instead of popping.
          The lockup sits above it (z-50) so it stays crisp. */}
      <AnimatePresence>
        {(phase === 'splash' || phase === 'morph') && (
          <motion.div
            key="veil"
            className="bg-background fixed inset-0 z-40"
            exit={{ opacity: 0 }}
            transition={{ duration: VEIL_FADE_S, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Splash lockup — logo + wordmark, both carrying layoutIds so they morph down to the page copies
          together (the wordmark stays under the logo). Above the veil (z-50) so it reads crisp through
          the dissolve. Unmounts the instant we leave 'splash' so the shared-layoutId handoff is clean. */}
      {phase === 'splash' && (
        <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-6">
          <motion.div layoutId="brand-logo" className="size-44 sm:size-60">
            <AnimatedBrandLogo className="size-full" />
          </motion.div>
          {/* Hold the cascade until the dots have assembled. */}
          <IntroWordmark text={WORDMARK} delay={SCATTER_MS / 1000} layoutId="brand-wordmark" />
        </div>
      )}
    </BrandIntroContext.Provider>
  )
}
