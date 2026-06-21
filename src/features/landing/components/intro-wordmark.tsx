'use client'

import { motion, type Variants } from 'framer-motion'

// The brand wordmark revealed letter-by-letter during the splash — a framer-motion take on the
// left-to-right cascade the portfolio does with GSAP + split-type (ScrambleText's CASCADE_DELAY_MS).
// Each char is its own span so the container's staggerChildren walks them in sequence.

const STAGGER_S = 0.05 // gap between letters starting — the portfolio's 50ms cascade
const LETTER_S = 0.4 // each letter's own fade-up

// How long the full cascade takes once it starts, given the text. Exported so the intro can derive
// its reveal timing from the real string instead of a hardcoded guess that drifts if the name changes.
export function wordmarkDurationMs(text: string) {
  return (text.length * STAGGER_S + LETTER_S) * 1000
}

const letter: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: LETTER_S, ease: 'easeOut' },
  },
}

// `delay` (seconds) holds the whole cascade until the dots have finished assembling. `layoutId` lets
// the hero copy morph from this one (the lockup travels down together with the logo).
export function IntroWordmark({
  text,
  delay = 0,
  layoutId,
}: {
  text: string
  delay?: number
  layoutId?: string
}) {
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: STAGGER_S, delayChildren: delay } },
  }

  return (
    <motion.div
      layoutId={layoutId}
      aria-label={text}
      variants={container}
      initial="hidden"
      animate="show"
      className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl"
    >
      {[...text].map((char, i) => (
        <motion.span key={i} variants={letter} className="inline-block whitespace-pre">
          {char}
        </motion.span>
      ))}
    </motion.div>
  )
}
