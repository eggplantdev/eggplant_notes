import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'

type PropsT = { label: string; value: ReactNode; sub?: string }

// Presentational summary tile (due-today / streak). Server-safe; no domain knowledge.
export function StatCard({ label, value, sub }: PropsT) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="text-foreground mt-1.5 text-4xl leading-none font-bold">{value}</p>
        <p className="text-muted-foreground mt-2 text-xs">{sub}</p>
      </CardContent>
    </Card>
  )
}
