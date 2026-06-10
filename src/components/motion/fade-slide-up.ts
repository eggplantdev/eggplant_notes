import { useReducedMotion, type Transition } from 'framer-motion'

// The mount fade + slide-up shared by page-shell, the note-swap template, and animated list rows: fade in
// while sliding up from `y`, and under prefers-reduced-motion degrade to opacity-only with an instant
// (duration-0) change. Only that reduced-motion branching is shared — each surface passes its own slide
// distance and timing, which are deliberately different (a page mount eases slower than a list row).
//
// Spread the result onto a `motion.div`. Pass `exitY` for an <AnimatePresence> exit, and `layout` to
// enable framer's FLIP layout animation (auto-disabled under reduced motion).
type FadeSlideUpOptsT = {
  y?: number
  exitY?: number
  transition: Transition
  layout?: boolean
}

export function useFadeSlideUp({ y = 12, exitY, transition, layout }: FadeSlideUpOptsT) {
  const reduce = useReducedMotion()
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0 },
    ...(exitY !== undefined ? { exit: reduce ? { opacity: 0 } : { opacity: 0, y: exitY } } : {}),
    transition: reduce ? { duration: 0 } : transition,
    ...(layout !== undefined ? { layout: layout && !reduce } : {}),
  }
}
