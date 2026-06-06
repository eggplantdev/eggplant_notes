'use client'

import { Cell, PolarGrid, RadialBar, RadialBarChart } from 'recharts'

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

export type RadialDatumT = { key: string; value: number }

// Each datum is one ring; `key` must match a `config` entry, whose `color` ChartContainer exposes
// as `--color-<key>` for the fill. `glow` haloes each ring via per-Cell `color` + the ring-glow filter.
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
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[220px]">
        <RadialBarChart data={data} innerRadius={30} outerRadius={110}>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
          <PolarGrid gridType="circle" />
          <RadialBar dataKey="value">
            {data.map((d) => {
              // style.color = fill so the ring-glow filter's currentColor matches each ring.
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
        </RadialBarChart>
      </ChartContainer>
      {/* Legend below the chart (not in the SVG) — doubles as the non-hover / screen-reader count
          readout since the tooltip is hover-only. Colours from `config` (global theme tokens),
          not the chart-scoped `--color-<key>`. */}
      <ul className="text-muted-foreground mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: config[d.key]?.color }}
            />
            <span>{String(config[d.key]?.label ?? d.key)}</span>
            <span className="text-foreground font-mono font-medium tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
