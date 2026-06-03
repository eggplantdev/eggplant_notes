'use client'

import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

type AnimatedListItemPropsT = {
  children: ReactNode
  className?: string
  layoutId?: string
  // Opt-in FLIP layout animation. Off by default — without this, intra-item content
  // changes won't transform unrelated descendants. Required when the parent uses
  // <AnimatePresence mode="popLayout"> for reordering.
  layout?: boolean
}

// Ported from the fest reference repo (components/wrappers/animated-list-item.tsx). One list
// row: fades + slides in on enter, out on exit, and (with layout) slides to its new position
// when siblings are added/removed. Honors prefers-reduced-motion → opacity-only.
export function AnimatedListItem({
  children,
  className,
  layoutId,
  layout = false,
}: AnimatedListItemPropsT) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      layout={layout && !shouldReduceMotion}
      layoutId={layoutId}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
