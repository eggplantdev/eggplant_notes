import type { ReactNode } from 'react'

export type SegmentedOptionT<V extends string> = {
  value: V
  label: ReactNode
  disabled?: boolean
  testId?: string
  // Fired on hover/focus of this segment — used to prefetch lazy content before the click
  // (e.g. the markdown Preview pane's Shiki chunk).
  onPrefetch?: () => void
}
