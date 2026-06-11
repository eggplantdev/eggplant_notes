import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import { BrandLogo } from './brand-logo'

type BrandMarkPropsT = ComponentProps<typeof Link> & {
  size?: 'sm' | 'lg'
  // Opts into the desktop-nav hover affordance; the mark is plain everywhere else.
  interactive?: boolean
  // Per-call wordmark tweaks — e.g. the desktop nav hides the text below `lg`.
  wordmarkClassName?: string
}

// Literal lookups so Tailwind can scan the size classes (it can't read `size-${x}`).
const LOGO_SIZE = { sm: 'size-8 md:size-9', lg: 'size-16 md:size-20' } as const
const TEXT_SIZE = { sm: 'text-sm md:text-base', lg: 'text-3xl md:text-4xl' } as const

export function BrandMark({
  size = 'sm',
  interactive = false,
  className,
  wordmarkClassName,
  ...props
}: BrandMarkPropsT) {
  return (
    <Link
      aria-label="eggplant_notes"
      className={cn('group flex shrink-0 items-center gap-1', className)}
      {...props}
    >
      <BrandLogo className={LOGO_SIZE[size]} />
      <span
        className={cn(
          'font-mono font-semibold',
          TEXT_SIZE[size],
          interactive &&
            'group-hover:bg-muted group-hover:text-foreground dark:group-hover:bg-muted/50 rounded-md py-1 transition-colors',
          wordmarkClassName,
        )}
      >
        eggplant_notes
      </span>
    </Link>
  )
}
