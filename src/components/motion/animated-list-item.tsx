'use client'

import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

type AnimatedListItemPropsT = {
  children: ReactNode
  className?: string
  layoutId?: string
  // Required when the parent uses <AnimatePresence mode="popLayout"> for reordering (FLIP layout animation).
  layout?: boolean
}

// One list row: fades/slides on enter/exit, and (with layout) slides to its new position on reorder.
// Honors prefers-reduced-motion → opacity-only.
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
