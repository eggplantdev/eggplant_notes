'use client'

import dynamic from 'next/dynamic'

import type { ChartConfig } from '@/components/ui/chart'
import { Spinner } from '@/components/ui/spinner'
import type { RadialDatumT } from '@/features/memory-cards/components/radial-count-chart'

type PropsT = {
  data: RadialDatumT[]
  config: ChartConfig
  glow?: boolean
}

// recharts is the app's single heaviest client dependency (~99 kB gz / ~334 kB parsed) and renders
// ONLY here, on /memory-cards. A static import puts it on the route's initial JS and runs recharts'
// parse/execute inside the hydration window. `ssr: false` defers it to a separate chunk loaded after
// the page is interactive; while it loads we show the brand-hued gradient Spinner (same one as AI
// generation) centred in a box that reserves the chart's footprint (aspect-square max-w-[220px] +
// legend line) so the swap-in causes no layout shift. Must live in a Client Component — `ssr: false`
// is rejected in Server Components (cards-overview.tsx is one).
const RadialCountChart = dynamic(
  () =>
    import('@/features/memory-cards/components/radial-count-chart').then((m) => m.RadialCountChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center">
        <div className="flex aspect-square w-full max-w-[220px] items-center justify-center">
          <Spinner className="size-10 [--spinner-w:4px]" />
        </div>
        <div className="mt-3 h-4" />
      </div>
    ),
  },
)

export function LazyRadialCountChart(props: PropsT) {
  return <RadialCountChart {...props} />
}
