'use client'

import { type ChartConfig } from '@/components/ui/chart'
import { RadialCountChart } from '@/features/memory-cards/components/radial-count-chart'

// Mature = stability past the maturity line; young = everything else. Neon fuchsia (still
// volatile) inner vs neon cyan (settled) outer — data order below puts mature on the inner ring
// (last datum = outer ring in recharts). The `glow` prop haloes each ring in its own colour.
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
