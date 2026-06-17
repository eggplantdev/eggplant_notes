'use client'

import { useRouter } from 'next/navigation'

import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { rateMemoryCard } from '@/features/review/actions/rate-memory-card'
import { GRADES } from '@/features/review/grades'
import { useReviewCelebration } from '@/features/review/components/review-celebration-context'
import { useActionTransition } from '@/hooks/use-action-transition'

// advanceHref: where to go after a successful rating. The /memory-cards panel passes the filtered
// listing URL WITHOUT the `?review` param, so rating a card clears the in-place selection and the
// re-render shows the next card. The dashboard omits it — there, the action's revalidatePath alone
// swaps to the next due card in place.
type PropsT = {
  memoryCardId: string
  previews: Record<number, string>
  goal: number
  advanceHref?: string
}

export function RatingButtons({ memoryCardId, previews, goal, advanceHref }: PropsT) {
  const { error, isPending, run } = useActionTransition()
  const { celebrate } = useReviewCelebration()
  const router = useRouter()

  // Rating triggers a nuclear revalidatePath('/', 'layout') so the whole surface (next card + list
  // due dates + overview) re-renders honestly — real latency, so show the page-centered loader.
  return (
    <div className="mt-6 flex flex-col gap-3">
      <FormError message={error} />
      {isPending && <LoadingOverlay />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GRADES.map(({ grade, label, variant }) => (
          <Button
            key={grade}
            variant={variant}
            size="lg"
            disabled={isPending}
            onClick={() =>
              run(() => rateMemoryCard(memoryCardId, grade, goal)).then((result) => {
                if (!result.success) return
                if (result.celebrate) celebrate(result.celebrate)
                // Clear the in-place selection so the next card surfaces; replace (not push) keeps
                // the rated card out of history. scroll:false — the panel stays put and fades the
                // swap (ReviewCardTransition); no jump to the top of the page.
                if (advanceHref) router.replace(advanceHref, { scroll: false })
              })
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
