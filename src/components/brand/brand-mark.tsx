import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import { BrandLogo } from './brand-logo'

export type BrandMarkPropsT = ComponentProps<typeof Link> & {
  size?: 'sm' | 'lg'
  // Per-call wordmark tweaks — e.g. the desktop nav hides the text below `lg`.
  wordmarkClassName?: string
}

// Literal lookups so Tailwind can scan the size classes (it can't read `size-${x}`).
const LOGO_SIZE = { sm: 'size-11', lg: 'size-14 md:size-16' } as const
const TEXT_SIZE = { sm: 'text-sm md:text-base', lg: 'text-2xl md:text-3xl' } as const

// Hover glow: transparent base → soft-cyan on group-hover, fading over 300ms. Tokens in globals.css.
const GLOW =
  'drop-shadow-glow-cyan-soft-off group-hover:drop-shadow-glow-cyan-soft transition duration-300'

export function BrandMark({
  size = 'sm',
  className,
  wordmarkClassName,
  ...props
}: BrandMarkPropsT) {
  // The mark is always a link, so the hover affordance + transition are always on.
  return (
    <Link
      aria-label="eggplant_notes"
      className={cn('group flex shrink-0 items-center gap-1', className)}
      {...props}
    >
      <BrandLogo className={cn(LOGO_SIZE[size], GLOW)} />
      <span className={cn(GLOW, 'font-mono font-semibold', TEXT_SIZE[size], wordmarkClassName)}>
        eggplant_notes
      </span>
    </Link>
  )
}
