import { cn } from '@/lib/utils'

export type GoalBarVariantT = 'aurora' | 'fuchsia' | 'mono' | 'white'

type PropsT = {
  label: string
  reviewed: number
  goal: number
  variant?: GoalBarVariantT
  // Text shown once the goal is hit, e.g. "Daily goal hit" / "Weekly goal hit" (the caller
  // includes any emoji it wants in the string).
  goalHitText?: string
}

// Per-variant fill gradient, glow utilities, and goal-hit accent colour. Literal class strings
// (not built from the variant token) because Tailwind only scans static class names — a
// template like `from-neon-${x}` would never be generated. Keep each entry's classes spelled
// out in full for the same reason.
const VARIANT: Record<
  GoalBarVariantT,
  { fill: string; glow: string; glowHit: string; accent: string }
> = {
  aurora: {
    fill: 'from-neon-green to-neon-cyan',
    glow: 'neon-glow',
    glowHit: 'neon-glow-hit',
    accent: 'text-neon-cyan',
  },
  fuchsia: {
    fill: 'from-neon-green via-neon-cyan via-60% to-neon-fuchsia',
    glow: 'neon-glow-fuchsia',
    glowHit: 'neon-glow-fuchsia-hit',
    accent: 'text-neon-fuchsia',
  },
  mono: {
    fill: 'from-neon-green to-neon-green',
    glow: 'neon-glow-green',
    glowHit: 'neon-glow-green-hit',
    accent: 'text-neon-green',
  },
  white: {
    fill: 'from-neutral-200 to-white',
    glow: 'neon-glow-white',
    glowHit: 'neon-glow-white-hit',
    accent: 'text-foreground',
  },
}

// Reusable goal progress bar: a bare ~4px neon line that fills toward a goal, sitting over the
// content (no track background/outline). Static (no animation). `variant` picks the colour
// scheme; at ≥100% the fill intensifies its glow (goal-hit) and `goalHitText` appears. The
// filled width is the one allowed inline style (a dynamic percentage Tailwind can't express as
// a token). Domain-free — callers pass reviewed/goal already computed.
export function GoalProgressBar({
  label,
  reviewed,
  goal,
  variant = 'aurora',
  goalHitText = 'Goal hit',
}: PropsT) {
  const pct = goal > 0 ? Math.min(reviewed / goal, 1) : 0
  // Guard on goal > 0 so a zero/absent goal doesn't read as an instant "goal hit" on an empty bar.
  const hit = goal > 0 && reviewed >= goal
  const v = VARIANT[variant]

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground flex min-h-6 w-full items-center justify-between">
          <span className="leading-none">{label}</span>
          {hit && (
            <span className={cn('leading-none font-medium tracking-wide uppercase', v.accent)}>
              {goalHitText}
            </span>
          )}
        </span>
        <span className="shrink-0 leading-none tabular-nums">
          {reviewed} / {goal}
        </span>
      </div>
      {/* Track sets the 100% reference width and shows a barely-visible empty state (the default
          border colour); the line itself is the fill. */}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(reviewed, goal)}
        aria-valuetext={`${reviewed} / ${goal}`}
        className="bg-border h-1 w-full rounded-full"
      >
        <div
          className={cn('h-full rounded-full bg-linear-to-r', v.fill, hit ? v.glowHit : v.glow)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}
