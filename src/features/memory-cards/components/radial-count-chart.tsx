'use client'

import { Cell, PolarGrid, RadialBar, RadialBarChart } from 'recharts'

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

export type RadialDatumT = { key: string; value: number }

// Shared radial-grid skeleton (shadcn chart-radial-grid). Each datum is one ring; `key` must
// match a `config` entry, whose `color` ChartContainer exposes as `--color-<key>` for the fill.
// `glow` haloes each ring in its own colour (via per-Cell `color` + the ring-glow filter).
export function RadialCountChart({
  data,
  config,
  glow = false,
}: {
  data: RadialDatumT[]
  config: ChartConfig
  glow?: boolean
}) {
  return (
    <>
      {/* Counts as text for screen-reader / non-hover users — the rings convey them only
          visually, the tooltip only on hover. */}
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.key}>
            {String(config[d.key]?.label ?? d.key)}: {d.value}
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[220px]">
        <RadialBarChart data={data} innerRadius={30} outerRadius={110}>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
          <PolarGrid gridType="circle" />
          <RadialBar dataKey="value">
            {data.map((d) => {
              // color = fill so the ring-glow filter's currentColor matches each ring.
              const fill = `var(--color-${d.key})`
              return (
                <Cell
                  key={d.key}
                  fill={fill}
                  className={glow ? 'ring-glow' : undefined}
                  style={glow ? { color: fill } : undefined}
                />
              )
            })}
          </RadialBar>
          <ChartLegend content={<ChartLegendContent nameKey="key" />} />
        </RadialBarChart>
      </ChartContainer>
    </>
  )
}
