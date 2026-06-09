'use client'

import { type ChartConfig } from '@/components/ui/chart'
import { RadialCountChart } from '@/features/memory-cards/components/radial-count-chart'
import { FSRS_STATE_LABELS } from '@/features/memory-cards/constants'

// Keys match FSRS_STATE_LABELS lowercased.
const chartConfig = {
  value: { label: 'Cards' },
  new: { label: 'New', color: 'var(--color-neon-fuchsia)' },
  learning: { label: 'Learning', color: 'var(--color-neon-cyan)' },
  review: { label: 'Review', color: 'var(--color-neon-violet)' },
  relearning: { label: 'Relearning', color: 'var(--color-neon-green)' },
} satisfies ChartConfig

// Index = FSRS state integer.
export function CardsByStateChart({ stateCounts }: { stateCounts: number[] }) {
  const data = FSRS_STATE_LABELS.map((label, i) => ({
    key: label.toLowerCase(),
    value: stateCounts[i],
  }))

  return <RadialCountChart data={data} config={chartConfig} glow />
}
