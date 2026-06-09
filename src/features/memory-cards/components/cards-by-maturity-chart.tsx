'use client'

import type { ChartConfig } from '@/types/chart'
import { RadialCountChart } from '@/features/memory-cards/components/radial-count-chart'

// Data order puts mature on the inner ring (recharts renders the last datum as the outer ring).
const chartConfig = {
  value: { label: 'Cards' },
  mature: { label: 'Mature', color: 'var(--color-neon-fuchsia)' },
  young: { label: 'Young', color: 'var(--color-neon-cyan)' },
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
