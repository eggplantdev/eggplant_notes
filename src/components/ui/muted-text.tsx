import { Slot } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// `as="span"` for use inside another paragraph (nested <p> is invalid); `asChild` merges the
// styling onto a child element (e.g. a <Link>) instead of emitting a wrapper.
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
