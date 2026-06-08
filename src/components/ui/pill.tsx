import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Small muted label chip used for subject/tag names. Read-only by default (a `<span>`); pass
// `onRemove` to get the closeable form (a `<button>` with a trailing X) used by filter chips.
type PillPropsT = {
  children: ReactNode
  className?: string
  // When set, renders the closeable button form; `removeLabel` is the X button's aria-label.
  onRemove?: () => void
  removeLabel?: string
}

const baseClasses = 'bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-medium'

export function Pill({ children, className, onRemove, removeLabel }: PillPropsT) {
  if (onRemove) {
    return (
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className={cn(baseClasses, 'hover:bg-muted/70 flex items-center gap-1', className)}
      >
        <span className="line-clamp-1 max-w-40">{children}</span>
        <X className="size-3 shrink-0" />
      </button>
    )
  }

  return <span className={cn(baseClasses, 'line-clamp-1 max-w-full', className)}>{children}</span>
}
