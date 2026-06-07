'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type SegmentedOptionT<V extends string> = {
  value: V
  label: ReactNode
  disabled?: boolean
  testId?: string
  // Fired on hover/focus of this segment — used to prefetch lazy content before the click
  // (e.g. the markdown Preview pane's Shiki chunk).
  onPrefetch?: () => void
}

type SegmentedTogglePropsT<V extends string> = {
  value: V
  onChange: (value: V) => void
  options: SegmentedOptionT<V>[]
  size?: 'sm' | 'default'
  className?: string
  ariaLabel?: string
}

const SIZE = {
  sm: 'h-7 px-2.5 text-[0.8rem]',
  default: 'h-8 px-3 text-sm',
} as const

// Single-select segmented control where the active "pill" SLIDES between options (motion layoutId
// shared-layout animation), so switching blends instead of snapping. Always one value selected — no
// deselect. The track is muted; the active segment is a raised background pill.
export function SegmentedToggle<V extends string>({
  value,
  onChange,
  options,
  size = 'default',
  className,
  ariaLabel,
}: SegmentedTogglePropsT<V>) {
  // Unique per instance so two toggles on one page don't share the layoutId (which would make the
  // highlight teleport between them).
  const layoutId = useId()
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('bg-muted relative inline-flex w-fit gap-0.5 rounded-lg p-0.5', className)}
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={opt.disabled}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            onMouseEnter={opt.onPrefetch}
            onFocus={opt.onPrefetch}
            className={cn(
              'relative inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors outline-none',
              'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'disabled:pointer-events-none disabled:opacity-50',
              SIZE[size],
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="bg-background absolute inset-0 -z-0 rounded-md shadow-sm"
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', bounce: 0.15, duration: 0.25 }
                }
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
