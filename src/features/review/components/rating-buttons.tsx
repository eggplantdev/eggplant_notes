'use client'

import { useState } from 'react'

import { toastMessage } from '@/components/toasts'
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
  // Present only on the standalone card page (a queue walk); undefined on the dashboard / memory-cards.
  const advance = useQueueAdvance()
  // Queue walk only: guards a double-click in the brief window before the optimistic navigation
  // unmounts this component.
  const [submitted, setSubmitted] = useState(false)

  function rate(grade: number) {
    if (advance) {
      // Queue walk: persist the rating, THEN advance to the (already-prefetched) next card. We can't
      // advance before the write commits — the destination page recomputes the soonest-due card at
      // render, and an in-flight write would let it still see THIS card as due (the last card would
      // never reach "caught up", and mid-walk you'd briefly revisit a just-rated card). The next
      // route is warm from the mount-time prefetch, so the only wait is the RPC itself; no overlay,
      // just disabled buttons. The action skips revalidate so it can't invalidate the prefetch.
      // celebrate() lands fine after the navigation because the dialog state lives in the [id] layout
      // provider, not in this island.
      setSubmitted(true)
      void rateMemoryCard(memoryCardId, grade, goal, true).then((result) => {
        if (!result.success) {
          toastMessage(result.error, 'error')
          setSubmitted(false)
          return
        }
        if (result.celebrate) celebrate(result.celebrate)
        advance()
      })
      return
    }
    // In-place (dashboard, /memory-cards): keep the awaited transition + loader; the action's
    // revalidatePath re-renders the page to the next due card.
    void run(() => rateMemoryCard(memoryCardId, grade, goal, false)).then((result) => {
      if (result.success && result.celebrate) celebrate(result.celebrate)
    })
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <FormError message={error} />
      {/* Loader only on the in-place path; the queue walk is instant (prefetched), so no overlay. */}
      {isPending && <LoadingOverlay />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={isPending || submitted}
            onClick={() => rate(grade)}
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
