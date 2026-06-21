'use client'

import { motion } from 'framer-motion'

import { AnimatedBrandLogo } from '@/components/brand/animated-brand-logo'
import { useLandingIntro, WORDMARK } from './landing-intro-context'

// Shared by the morphing copy and the static copies so the wordmark looks identical before/after handoff.
const WORDMARK_CLASS = 'mt-3 font-mono text-lg font-semibold tracking-tight sm:text-xl'
// Same decelerating glide as the logo so the lockup lands as one piece.
const MORPH_TRANSITION = { layout: { duration: 1, ease: [0.22, 1, 0.36, 1] } } as const

export function LandingHero() {
  const phase = useLandingIntro()
  // Copy stays hidden until the logo has finished morphing (splash + morph), then fades up on reveal.
  const showText = phase !== 'splash' && phase !== 'morph'

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 text-center sm:px-8">
        <HeroLogo />
        <HeroWordmark />
        <motion.div
          className="mt-4 flex flex-col items-center"
          initial={false}
          animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 12 }}
          // Fade the copy up only on the reveal; otherwise it's just there, instantly.
          transition={phase === 'reveal' ? { duration: 0.5, delay: 0.15 } : { duration: 0 }}
        >
          <h1 className="font-heading mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            <span className="from-neon-green via-neon-cyan to-neon-fuchsia bg-linear-to-r bg-clip-text text-transparent">
              Wired for recall
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-base text-pretty sm:text-lg">
            Keep your coding notes in one place, group them into subjects, and turn them into
            spaced-repetition cards that link straight back to the note they came from.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function HeroLogo() {
  const phase = useLandingIntro()

  // The overlay owns the visible mark during the splash; reserve its footprint so layout doesn't shift.
  if (phase === 'splash') return <div aria-hidden className="size-20 sm:size-24" />

  // Handoff (morph + reveal): settled mark carrying the shared layoutId so framer morphs the splash copy
  // into it. Slow decelerating ease so it glides in rather than snapping; lifted to z-50 so it stays
  // above the opaque-then-dissolving veil and reads crisp the whole way.
  if (phase === 'morph' || phase === 'reveal') {
    return (
      <motion.div
        layoutId="brand-logo"
        className="relative z-50 size-20 sm:size-24"
        transition={MORPH_TRANSITION}
      >
        <AnimatedBrandLogo entrance={false} className="size-full" />
      </motion.div>
    )
  }

  // Morph finished — plain settled mark, no layoutId/z lift (so it can't overlap the sticky nav on scroll).
  if (phase === 'done') return <AnimatedBrandLogo entrance={false} className="size-20 sm:size-24" />

  // idle (intro not yet decided) + skip (returning visitor / reduced motion): scatter in place.
  return <AnimatedBrandLogo className="size-20 sm:size-24" />
}

// The brand wordmark beneath the logo — permanent in the hero. The splash lockup morphs its big copy
// down into this one (shared layoutId), so the text stays under the eggplant rather than fading away.
function HeroWordmark() {
  const phase = useLandingIntro()

  // Splash layer owns the visible wordmark; reserve its footprint here so the hero layout doesn't shift.
  if (phase === 'splash')
    return (
      <div aria-hidden className={`${WORDMARK_CLASS} invisible`}>
        {WORDMARK}
      </div>
    )

  // Handoff (morph + reveal): morph target for the splash wordmark; z-lifted above the veil like the logo.
  if (phase === 'morph' || phase === 'reveal') {
    return (
      <motion.div
        layoutId="brand-wordmark"
        className={`relative z-50 ${WORDMARK_CLASS}`}
        transition={MORPH_TRANSITION}
      >
        {WORDMARK}
      </motion.div>
    )
  }

  // done / idle / skip: plain settled wordmark, always under the logo.
  return <p className={WORDMARK_CLASS}>{WORDMARK}</p>
}
