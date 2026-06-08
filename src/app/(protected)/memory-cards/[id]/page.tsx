import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteMemoryCardButton } from '@/features/memory-cards/components/delete-memory-card-button'
import { getMemoryCardForReview } from '@/features/memory-cards/queries'
import { memoryCardEditHref } from '@/features/memory-cards/utils'
import { CardReviewQueue } from '@/features/review/components/card-review-queue'
import { ReviewPanel } from '@/features/review/components/review-panel'
import { getDailyGoal } from '@/features/settings/queries'

// On-demand single-card review: reuses ReviewPanel so any picked card can be reviewed, not just
// the soonest-due one. Next 16 `params` is a Promise.
export default async function MemoryCardReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [card, goal] = await Promise.all([getMemoryCardForReview(id), getDailyGoal()])
  if (!card) notFound()

  return (
    <PageShell
      title="Review card"
      width="prose"
      backHref="/memory-cards"
      backLabel="Memory cards"
      actions={
        <CardActions
          editHref={memoryCardEditHref(card.id)}
          // Deleting from the card's own page must navigate away — the route would otherwise 404 on
          // the deleted row (list rows just vanish via revalidate, so they pass no redirect).
          deleteControl={
            <DeleteMemoryCardButton
              id={card.id}
              noteId={card.note_id ?? undefined}
              redirectTo="/memory-cards"
            />
          }
        />
      }
    >
      {/* Server-render ReviewPanel (keeps its async markdown an RSC) and hand it to the client queue
          walker as children, so a rating advances to the next due card / caught-up. The celebration
          provider lives in this route's layout (survives navigating between cards), so ReviewPanel
          must not self-provide here. */}
      <CardReviewQueue>
        <ReviewPanel card={card} goal={goal} provideCelebration={false} />
      </CardReviewQueue>
    </PageShell>
  )
}
