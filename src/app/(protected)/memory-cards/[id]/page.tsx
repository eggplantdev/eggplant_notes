import { PageShell } from '@/components/layout/page-shell'
import { LinkCardButton } from '@/features/memory-cards/components/link-card-button'
import { getMemoryCardForReview } from '@/features/memory-cards/queries'
import { assertFound } from '@/lib/assert-found'
import { CardReviewQueue } from '@/features/review/components/card-review-queue'
import { ReviewPanel } from '@/features/review/components/review-panel'
import { getDailyGoal } from '@/features/settings/queries'
import { getSubjects } from '@/features/subjects/queries'

// On-demand single-card review: reuses ReviewPanel so any picked card can be reviewed, not just
// the soonest-due one. Next 16 `params` is a Promise.
export default async function MemoryCardReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [card, goal, subjects] = await Promise.all([
    getMemoryCardForReview(id),
    getDailyGoal(),
    getSubjects(),
  ])
  assertFound(card)

  return (
    <PageShell
      title="Review card"
      width="prose"
      backHref="/memory-cards"
      backLabel="Memory cards"
      actions={
        card.note_id ? undefined : (
          <LinkCardButton cardId={card.id} cardSubjectId={card.subject_id} subjects={subjects} />
        )
      }
    >
      {/* Server-render ReviewPanel (keeps its async markdown an RSC) and hand it to the client queue
          walker as children, so a rating advances to the next due card / caught-up. The celebration
          provider lives in this route's layout (survives navigating between cards), so ReviewPanel
          must not self-provide here. */}
      <CardReviewQueue>
        <ReviewPanel
          card={card}
          goal={goal}
          provideCelebration={false}
          showCardControls
          deleteRedirectTo="/memory-cards"
        />
      </CardReviewQueue>
    </PageShell>
  )
}
