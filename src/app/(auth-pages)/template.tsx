'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { useFadeSlideUp } from '@/components/motion/fade-slide-up'

// Auth pages don't render through PageShell, so the mount fade+slide lives here. A template (unlike
// the layout, which persists across navigations) re-mounts on every route change, so moving between
// sign-in / sign-up / reset replays the animation. Matches PageShell's timing; honors prefers-reduced-motion.
export default function AuthTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div {...useFadeSlideUp({ y: 20, transition: { duration: 0.4, ease: 'easeInOut' } })}>
      {children}
    </motion.div>
  )
}
