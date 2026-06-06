'use client'

import { type ChartConfig } from '@/components/ui/chart'
import { RadialCountChart } from '@/features/memory-cards/components/radial-count-chart'

// Mature = stability past the maturity line; young = everything else. Glowy white (settled,
// the standout) vs gray (still volatile) — the `glow` prop haloes each ring in its own colour.
const chartConfig = {
  value: { label: 'Cards' },
  mature: { label: 'Mature', color: '#ffffff' },
  young: { label: 'Young', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function CardsByMaturityChart({ mature, young }: { mature: number; young: number }) {
  return (
    <RadialCountChart
      data={[
        { key: 'mature', value: mature },
        { key: 'young', value: young },
      ]}
      config={chartConfig}
      glow
    />
  )
}
