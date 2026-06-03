import { FSRS_STATE_LABELS } from '@/features/dashboard/constants'
import type { StateCountsT } from '@/features/dashboard/types'

type PropsT = { counts: StateCountsT }

// FSRS state mix: New / Learning / Review / Relearning side by side. Labels come from the
// shared FSRS_STATE_LABELS const; the values map to the StateCountsT keys in the same order.
export function StateBreakdown({ counts }: PropsT) {
  const values = [counts.new, counts.learning, counts.review, counts.relearning]
  return (
    <div className="grid grid-cols-4 gap-2">
      {FSRS_STATE_LABELS.map((label, i) => (
        <div key={label} className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-foreground text-2xl font-bold tabular-nums">{values[i]}</p>
          <p className="text-muted-foreground mt-1 text-xs">{label}</p>
        </div>
      ))}
    </div>
  )
}
