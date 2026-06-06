import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { getMemoryCardForReview } from '@/features/memory-cards/queries'
import { ReviewPanel } from '@/features/review/review-panel'
import { getDailyGoal } from '@/features/settings/queries'

// On-demand single-card review (memory-card-review-page): reuses the dashboard's ReviewPanel so the
// user can review ANY card they pick, not just the soonest-due one the queue hands them.
// getMemoryCardForReview is RLS-scoped, so a missing OR not-owned id both 404. Rating flows through
// the unchanged rateMemoryCard, which now also revalidates this route — the page refreshes in place
// with the new schedule. Next 16 `params` is a Promise.
export default async function MemoryCardReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [card, goal] = await Promise.all([getMemoryCardForReview(id), getDailyGoal()])
  if (!card) notFound()

  return (
    <PageShell title="Review card" backHref="/memory-cards" backLabel="Memory cards">
      <ReviewPanel card={card} goal={goal} />
    </PageShell>
  )
}
