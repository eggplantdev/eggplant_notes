import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'

// `compact` shrinks the value type so four tiles read comfortably in a narrow side column.
type PropsT = { label: string; value: ReactNode; sub?: string; compact?: boolean }

export function StatCard({ label, value, sub, compact }: PropsT) {
  return (
    <Card>
      <CardContent>
        <SectionLabel>{label}</SectionLabel>
        <p
          className={`text-foreground mt-1.5 leading-none font-bold ${compact ? 'text-2xl' : 'text-4xl'}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">{sub}</p>
      </CardContent>
    </Card>
  )
}
