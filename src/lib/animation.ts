/**
 * Single source for UI animation timing, so overlays, drawers, and toggles animate in sync.
 *
 * Tailwind can't interpolate class names — `duration-${ms}` would never be scanned — so the
 * utility tokens below are literal strings (Tailwind's content scan of this file generates
 * them). `durationMs` is the same value for JS-driven animation (e.g. framer-motion
 * `transition`), where a raw number is what's needed. Keep the two representations in step.
 */
export const ANIMATION = {
  /** Reveal/dismiss timing — drawers, dialogs, overlays. */
  durationMs: 200,
  duration: 'duration-200',
  easing: 'ease-in-out',
} as const
