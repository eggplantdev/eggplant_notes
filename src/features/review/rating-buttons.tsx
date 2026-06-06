'use client'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { rateMemoryCard } from '@/features/review/actions/rate-memory-card'
import { GRADES } from '@/features/review/grades'
import { useReviewCelebration } from '@/features/review/review-celebration-context'
import { useActionTransition } from '@/hooks/use-action-transition'

type PropsT = { memoryCardId: string; previews: Record<number, string>; goal: number }

// Four rating buttons, each showing its predicted next interval (server-formatted). Clicking
// fires rateMemoryCard via useActionTransition (pending/disabled state + inline error); the
// action revalidates /dashboard (next due card streams in) and the standalone card page (it
// refreshes with the new schedule) — no client queue state, no useEffect. Buttons stack two-up
// on narrow widths (~360px), four-up from sm.
export function RatingButtons({ memoryCardId, previews, goal }: PropsT) {
  const { error, isPending, run } = useActionTransition()
  const { celebrate } = useReviewCelebration()

  return (
    <div className="mt-6 flex flex-col gap-3">
      <FormError message={error} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={isPending}
            onClick={() =>
              run(() => rateMemoryCard(memoryCardId, grade, goal), {
                successMessage: 'Review recorded',
              }).then((result) => {
                if (result.success && result.celebrate) celebrate(result.celebrate)
              })
            }
            className={cn(
              'h-auto flex-col gap-0.5 py-2',
              grade === 4 && 'neon-glow-green hover:neon-glow-green-hit transition-shadow',
            )}
          >
            <span className="font-semibold">{label}</span>
            <span className="text-xs opacity-80">{previews[grade]}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
