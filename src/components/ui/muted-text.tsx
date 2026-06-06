import { Slot } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Muted secondary-text treatment shared by card subtitles, descriptions, and source-note labels
// (subjects list/detail, the review card's "From:" link, the dashboard "needs attention" rows).
// Owns the `text-muted-foreground` + size + clamp/truncate combo those sites kept re-deriving (and
// had drifted on). Domain-free; the data and any layout (max-width, margins) ride on `className`.
// `asChild` merges the styling onto a child element — e.g. a Next <Link> — instead of emitting a
// wrapper; `interactive` adds the link hover. Renders as <p> by default; pass as="span" when it
// sits inside another paragraph (nested <p> is invalid HTML).
type MutedTextPropsT = {
  children: ReactNode
  as?: 'p' | 'span'
  size?: 'sm' | 'xs'
  clamp?: 1 | 2
  truncate?: boolean
  interactive?: boolean
  asChild?: boolean
  className?: string
}

// Literal lookup maps — Tailwind can't scan `line-clamp-${n}` template strings.
const SIZE = { sm: 'text-sm', xs: 'text-xs' } as const
const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2' } as const

export function MutedText({
  children,
  as = 'p',
  size = 'sm',
  clamp,
  truncate,
  interactive,
  asChild,
  className,
}: MutedTextPropsT) {
  // Render nothing for absent content (null/undefined/empty) so callers can drop their own
  // `desc ? … : null` guards and just pass an optional value straight through.
  if (children == null || children === '') return null

  const Comp = asChild ? Slot.Root : as

  return (
    <Comp
      className={cn(
        'text-muted-foreground',
        SIZE[size],
        clamp && CLAMP[clamp],
        truncate && 'truncate',
        interactive && 'hover:text-foreground',
        className,
      )}
    >
      {children}
    </Comp>
  )
}
