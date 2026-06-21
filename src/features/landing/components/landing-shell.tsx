import type { ComponentPropsWithoutRef, ElementType } from 'react'

import { cn } from '@/lib/utils'

type LandingShellPropsT = {
  // Landing sections vary their wrapper element (section / nav / div). Defaults to <section>.
  as?: ElementType
} & ComponentPropsWithoutRef<'section'>

// The marketing-column geometry for the public landing sections — width (max-w-6xl, narrower than
// the app shell's container-shell cap) plus gutters, defined in one place. Per-section layout
// (flex, alignment, vertical padding) comes in via className.
export function LandingShell({ as, className, children, ...rest }: LandingShellPropsT) {
  const Tag = as ?? 'section'
  return (
    <Tag className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', className)} {...rest}>
      {children}
    </Tag>
  )
}
