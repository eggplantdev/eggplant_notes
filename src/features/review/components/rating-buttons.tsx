'use client'

import { useState } from 'react'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { rateMemoryCard } from '@/features/review/actions/rate-memory-card'
import { GRADES } from '@/features/review/grades'
import { useQueueAdvance } from '@/features/review/components/queue-advance-context'
import { useReviewCelebration } from '@/features/review/components/review-celebration-context'
import { useActionTransition } from '@/hooks/use-action-transition'

type PropsT = { memoryCardId: string; previews: Record<number, string>; goal: number }

export function RatingButtons({ memoryCardId, previews, goal }: PropsT) {
  const { error, isPending, run } = useActionTransition()
  const { celebrate } = useReviewCelebration()
  // Present only on the standalone card page (a queue walk); undefined on the dashboard.
  const advance = useQueueAdvance()
  // The card-page advance is a router.push that fires AFTER the transition resolves, so isPending no
  // longer covers it — track that nav separately so the loader spans it too. Set true and never
  // reset: the push unmounts this component, mounting a fresh one for the next card.
  const [isAdvancing, setIsAdvancing] = useState(false)
  const busy = isPending || isAdvancing

  // Rating triggers a nuclear revalidatePath('/', 'layout') (dashboard re-renders in place) or a
  // queue-walk router.push — both have real latency, so show the standard page-centered loader
  // meanwhile (also covers the post-transition router.push the queue walk does, via isAdvancing).
  return (
    <div className="mt-6 flex flex-col gap-3">
      <FormError message={error} />
      {busy && <LoadingOverlay />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={busy}
            onClick={() =>
              run(() => rateMemoryCard(memoryCardId, grade, goal, Boolean(advance))).then(
                (result) => {
                  if (!result.success) return
                  // Celebrate AND advance: the dialog lives in the [id] layout's provider, so it
                  // survives the queue walk navigating to the next card behind it.
                  if (result.celebrate) celebrate(result.celebrate)
                  // A truthy nextDueId means advance() will router.push — keep the loader up across
                  // it. An undefined id (caught up) swaps to CaughtUpNotice in place, no nav.
                  if (advance && result.nextDueId) setIsAdvancing(true)
                  advance?.(result.nextDueId)
                },
              )
            }
            className="h-auto flex-col gap-0.5 py-2"
          >
            <span className="font-semibold">{label}</span>
            <span className="text-xs opacity-80">{previews[grade]}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
