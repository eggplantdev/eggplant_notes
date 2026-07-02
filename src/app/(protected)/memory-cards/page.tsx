import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { CardsOverviewSection } from '@/features/memory-cards/components/cards-overview-section'
import { MemoryCardsListSection } from '@/features/memory-cards/components/memory-cards-list-section'
import { ReviewPanelSection } from '@/features/memory-cards/components/review-panel-section'
import {
  getDueQueue,
  getMemoryCardForReview,
  getSoonestReviewCard,
} from '@/features/memory-cards/queries'
import { parseCardFilters } from '@/features/memory-cards/utils'
import { getReviewCounts } from '@/features/review-events/queries'
import { getDailyGoal } from '@/features/settings/queries'
import { parsePagination } from '@/lib/utils/pagination'
import { Suspense } from 'react'

// The "Cards overview" chart is the ONE exception to the filtered/paginated view — it counts the
// ENTIRE deck via getCardOverview (ignores q/page/subjects), so it stays a stable whole-deck stat.
export default async function MemoryCardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    subjects?: string
    q?: string
    state?: string
    maturity?: string
    due?: string
    page?: string
    // The card the in-place review panel is showing. Clicking a list card sets it; absent → the
    // panel falls back to the soonest-due card, then (nothing due) the soonest card overall.
    review?: string
  }>
}) {
  const resolvedSearchParams = await searchParams
  const selectedIds = (resolvedSearchParams.subjects ?? '').split(',').filter(Boolean)
  const searchQuery = resolvedSearchParams.q ?? ''
  const { states, maturity, due } = parseCardFilters(resolvedSearchParams)
  const { page, limit } = parsePagination(resolvedSearchParams)
  const filters = { subjectIds: selectedIds, q: searchQuery, states, maturity, due }
  // Fast path: only what the review panel (primary content) needs — all fast indexed reads, resolved
  // in parallel. Everything else streams: the filters + list (subjects + count-exact query) in
  // MemoryCardsListSection, the overview RPC in CardsOverviewSection. So nothing below the panel
  // blocks this paint.
  const [{ first: dueCard }, dailyGoal, { today: reviewedToday }] = await Promise.all([
    getDueQueue(filters),
    getDailyGoal(),
    getReviewCounts(),
  ])

  // Priority: an explicitly clicked card (due or not) → the soonest-due card → the soonest card
  // overall, so the user can keep reviewing ahead when nothing is due.
  const selectedCard = resolvedSearchParams.review
    ? await getMemoryCardForReview(resolvedSearchParams.review)
    : undefined
  let reviewCard = selectedCard ?? dueCard
  if (!reviewCard) reviewCard = await getSoonestReviewCard(filters)

  // Goal met → any card still shown is a bonus review beyond it (guarded on a card existing so the
  // notice never stacks above the empty caught-up state).
  const reviewingAhead = dailyGoal > 0 && reviewedToday >= dailyGoal && Boolean(reviewCard)

  // Navigate after a rating only to clear an explicit `?review` selection; the normal due-queue loop
  // advances via the rating's revalidatePath re-render (a second navigation would re-run the page for
  // nothing). `undefined` → RatingButtons skips router.replace and lets the revalidate advance.
  let advanceHref: string | undefined
  if (resolvedSearchParams.review) {
    const advanceParams = new URLSearchParams()
    for (const key of ['subjects', 'q', 'state', 'maturity', 'due', 'page'] as const) {
      const value = resolvedSearchParams[key]
      if (value) advanceParams.set(key, value)
    }
    advanceHref = advanceParams.size ? `/memory-cards?${advanceParams}` : '/memory-cards'
  }

  return (
    <PageShell
      title="Memory cards"
      actions={<ButtonLink href="/memory-cards/new">New card</ButtonLink>}
    >
      <div className="flex flex-col gap-12">
        {/* Primary content, NOT streamed: the review panel is why you're on this page, so it renders
          in the first paint from the fast-path data above. ReviewPanelSection is presentational — it
          renders nothing when there's no card (empty deck → the list's empty state shows below); the
          page owns the fetching. */}
        <ReviewPanelSection
          card={reviewCard}
          goal={dailyGoal}
          reviewingAhead={reviewingAhead}
          advanceHref={advanceHref}
          scrollOnMount={Boolean(resolvedSearchParams.review)}
        />

        <Suspense>
          <CardsOverviewSection />
        </Suspense>

        <Suspense>
          <MemoryCardsListSection filters={filters} page={page} limit={limit} />
        </Suspense>
      </div>
    </PageShell>
  )
}
