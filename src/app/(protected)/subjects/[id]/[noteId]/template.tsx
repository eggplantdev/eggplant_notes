'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { useFadeSlideUp } from '@/components/motion/fade-slide-up'

// A template (unlike a layout) re-mounts on every navigation, so switching notes replays the
// fade+slide that masks the server-segment swap. No loading.tsx skeleton, so the previous note
// stays visible during the swap then animates over. Honors prefers-reduced-motion (opacity-only).
export default function SubjectReadNoteTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div {...useFadeSlideUp({ transition: { duration: 0.25, ease: 'easeOut' } })}>
      {children}
    </motion.div>
  )
}
