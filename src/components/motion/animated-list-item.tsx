'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

import { useFadeSlideUp } from '@/components/motion/fade-slide-up'
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
  return (
    <motion.div
      layoutId={layoutId}
      {...useFadeSlideUp({ exitY: -8, transition: { duration: 0.2, ease: 'easeOut' }, layout })}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
