'use client'

import * as React from 'react'
import { Separator as SeparatorPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils/index'

// `ai` paints the green→cyan brand gradient (following orientation) instead of a flat border — the
// single source for the "AI-generated content" divider, so features don't hand-roll a gradient div.
const SEPARATOR_VARIANT = {
  default: 'bg-border',
  ai: 'from-neon-green to-neon-cyan data-horizontal:bg-linear-to-r data-vertical:bg-linear-to-b',
} as const

type SeparatorPropsT = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  variant?: keyof typeof SEPARATOR_VARIANT
}

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  variant = 'default',
  ...props
}: SeparatorPropsT) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        // `my-6` default so layouts don't each repeat it; tighter consumers override via `className` (twMerge wins).
        'my-6 shrink-0 data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch',
        SEPARATOR_VARIANT[variant],
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
