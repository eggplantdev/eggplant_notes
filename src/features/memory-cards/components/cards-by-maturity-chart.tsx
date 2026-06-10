'use client'

import { type ChartConfig } from '@/components/ui/chart'
import { LazyRadialCountChart } from '@/features/memory-cards/components/radial-count-chart-lazy'

// Data order puts mature on the inner ring (recharts renders the last datum as the outer ring).
const chartConfig = {
  value: { label: 'Cards' },
  mature: { label: 'Mature', color: 'var(--color-neon-fuchsia)' },
  young: { label: 'Young', color: 'var(--color-neon-cyan)' },
} satisfies ChartConfig

export function CardsByMaturityChart({ mature, young }: { mature: number; young: number }) {
  return (
    <LazyRadialCountChart
      data={[
        { key: 'mature', value: mature },
        { key: 'young', value: young },
      ]}
      config={chartConfig}
      glow
    />
  )
}
