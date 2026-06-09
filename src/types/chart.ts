import type { ComponentType, ReactNode } from 'react'

// Series config for the shadcn chart primitive (the `config` prop callers pass to ChartContainer).
// Theme keys ('light' | 'dark') mirror the THEMES map in components/ui/chart.tsx — if a theme is added
// there, widen this union to match.
export type ChartConfig = Record<
  string,
  {
    label?: ReactNode
    icon?: ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  )
>
