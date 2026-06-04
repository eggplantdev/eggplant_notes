'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Per-navigation animation for the content pane. A template (unlike a layout) re-mounts on
// every navigation, so switching to a different note remounts this wrapper and replays the
// enter transition — a fade+slide that masks the server-segment swap. Mirrors PageShell's
// motion treatment and honors prefers-reduced-motion (opacity-only). No loading.tsx skeleton:
// without one the previous note stays visible during the swap, then animates over.
export default function SubjectReadNoteTemplate({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
