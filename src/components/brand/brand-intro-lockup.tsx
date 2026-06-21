'use client'

import { motion } from 'framer-motion'

import { AnimatedBrandLogo } from './animated-brand-logo'
import { useBrandIntro, WORDMARK } from './brand-intro-context'

// Where the splash lockup lands. Drop this on any page wrapped in <BrandIntroProvider>; it consumes the
// intro phase and renders the logo + wordmark as a placeholder → morph target → settled mark. Sizes are
// per-page (the hero is bigger than the auth mark), so they're props rather than baked in.

// Decelerating glide (easeOutExpo) shared by logo + wordmark so the lockup lands as one piece.
const MORPH_TRANSITION = { layout: { duration: 1, ease: [0.22, 1, 0.36, 1] } } as const

type BrandIntroLockupPropsT = {
  className?: string
  logoClassName?: string
  wordmarkClassName?: string
}

export function BrandIntroLockup({
  className = 'flex flex-col items-center',
  logoClassName = 'size-20 sm:size-24',
  wordmarkClassName = 'mt-3 font-mono text-lg font-semibold tracking-tight sm:text-xl',
}: BrandIntroLockupPropsT) {
  const phase = useBrandIntro()

  // Splash layer owns the visible lockup; reserve its footprint here so the page layout doesn't shift.
  if (phase === 'splash') {
    return (
      <div aria-hidden className={className}>
        <div className={logoClassName} />
        <div className={`${wordmarkClassName} invisible`}>{WORDMARK}</div>
      </div>
    )
  }

  // Handoff (morph + reveal): morph targets carrying the shared layoutIds, z-lifted above the veil so
  // they read crisp the whole way down.
  if (phase === 'morph' || phase === 'reveal') {
    return (
      <div className={className}>
        <motion.div
          layoutId="brand-logo"
          className={`relative z-50 ${logoClassName}`}
          transition={MORPH_TRANSITION}
        >
          <AnimatedBrandLogo entrance={false} className="size-full" />
        </motion.div>
        <motion.div
          layoutId="brand-wordmark"
          className={`relative z-50 ${wordmarkClassName}`}
          transition={MORPH_TRANSITION}
        >
          {WORDMARK}
        </motion.div>
      </div>
    )
  }

  // done — settled mark, no layoutId/z lift (so it can't overlap a sticky nav on scroll).
  if (phase === 'done') {
    return (
      <div className={className}>
        <AnimatedBrandLogo entrance={false} className={logoClassName} />
        <p className={wordmarkClassName}>{WORDMARK}</p>
      </div>
    )
  }

  // idle (intro not yet decided) + skip (returning visitor / reduced motion): scatter in place.
  return (
    <div className={className}>
      <AnimatedBrandLogo className={logoClassName} />
      <p className={wordmarkClassName}>{WORDMARK}</p>
    </div>
  )
}
