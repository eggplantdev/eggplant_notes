import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Small uppercase muted caption above a stat, chart, or control group. Renders a `<p>` by default;
// pass `as="span"` for inline use (e.g. a label beside a button row).
type SectionLabelPropsT = {
  children: ReactNode
  className?: string
  as?: 'p' | 'span'
}

const baseClasses = 'text-muted-foreground text-xs font-medium tracking-wide uppercase'

export function SectionLabel({ children, className, as: Tag = 'p' }: SectionLabelPropsT) {
  return <Tag className={cn(baseClasses, className)}>{children}</Tag>
}
