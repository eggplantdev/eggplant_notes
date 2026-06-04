import { computeDailyProgress } from '@/features/dashboard/daily-progress'
import { cn } from '@/lib/utils'

type PropsT = { reviewed: number; goal: number }

// L4 daily-goal bar: a bare ~4px neon green→cyan line that fills toward today's goal, sitting
// over the dashboard content (no track background/outline). Static (no animation). At ≥100% the
// fill intensifies its glow (goal-hit) and a `+N bonus` badge shows the overshoot. The filled
// width is the one allowed inline style (a dynamic percentage Tailwind can't express as a token).
export function DailyProgressBar({ reviewed, goal }: PropsT) {
  const { pct, hit, bonus } = computeDailyProgress(reviewed, goal)

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-2">
          Today&rsquo;s progress
          {hit && (
            <span className="text-neon-cyan text-2xs font-medium tracking-wide uppercase">
              Goal hit{bonus > 0 && ` · +${bonus} bonus`}
            </span>
          )}
        </span>
        <span className="tabular-nums">
          {reviewed} / {goal}
        </span>
      </div>
      {/* Transparent track only sets the 100% reference width; the line itself is the fill. */}
      <div className="h-1 w-full">
        <div
          className={cn(
            'from-neon-green to-neon-cyan h-full rounded-full bg-linear-to-r',
            hit ? 'neon-glow-hit' : 'neon-glow',
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}
