import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { UrlMultiSelectFilter } from '@/components/ui/url-multi-select-filter'
import { CardsOverviewSection } from '@/features/memory-cards/components/cards-overview-section'
import { MemoryCardsList } from '@/features/memory-cards/components/memory-cards-list'
import { DUE_OPTIONS, FSRS_STATE_LABELS, MATURITY_OPTIONS } from '@/features/memory-cards/constants'
import {
  getDueQueue,
  getMemoryCardForReview,
  getMemoryCardsList,
  getSoonestReviewCard,
} from '@/features/memory-cards/queries'
import { parseCardFilters } from '@/features/memory-cards/utils'
import { getReviewCounts } from '@/features/review-events/queries'
import { REVIEW_PANEL_ID } from '@/features/review/constants'
import { ReviewCardTransition } from '@/features/review/components/review-card-transition'
import { ReviewPanel } from '@/features/review/components/review-panel'
import { getDailyGoal } from '@/features/settings/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'
import { Spinner } from '@/components/ui/spinner'
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
  const [
    subjects,
    { rows: cards, total },
    { first: dueCard },
    dailyGoal,
    { today: reviewedToday },
  ] = await Promise.all([
    getSubjects(),
    getMemoryCardsList({ ...filters, page, limit }),
    // Same filters as the listing → the review panel is scoped to the active topic.
    getDueQueue(filters),
    getDailyGoal(),
    // Global (not filter-scoped) — the daily goal counts distinct cards reviewed today across the
    // whole deck, same as the dashboard.
    getReviewCounts(),
  ])

  // The card to review, in priority: an explicitly clicked card (due or not) → the soonest-due card
  // → the soonest card overall so the user can keep reviewing ahead when nothing is due.
  const selectedCard = resolvedSearchParams.review
    ? await getMemoryCardForReview(resolvedSearchParams.review)
    : undefined
  let reviewCard = selectedCard ?? dueCard
  if (!reviewCard) reviewCard = await getSoonestReviewCard(filters)
  // "Reviewing ahead" = today's goal is met (the persistent counterpart to the one-shot goal-crossing
  // celebration), so any card still shown is a bonus review beyond the goal. Guarded on a card
  // existing so the notice never stacks above the empty caught-up state.
  const reviewingAhead = dailyGoal > 0 && reviewedToday >= dailyGoal && Boolean(reviewCard)

  // Only navigate after a rating when there's an explicit `?review` selection to clear. In the normal
  // due-queue loop (`?review` absent) the rating's `revalidatePath` re-render already advances to the
  // next card — the rated card's due_at moved to the future, so getDueQueue returns the next one — so
  // a second navigation would re-run the whole page for nothing. When a specific card WAS clicked we
  // must strip `?review` (else the panel keeps showing the just-rated card); advanceHref preserves the
  // other filters. `undefined` → RatingButtons skips router.replace and lets the revalidate advance.
  let advanceHref: string | undefined
  if (resolvedSearchParams.review) {
    const advanceParams = new URLSearchParams()
    for (const key of ['subjects', 'q', 'state', 'maturity', 'due', 'page'] as const) {
      if (resolvedSearchParams[key]) advanceParams.set(key, resolvedSearchParams[key])
    }
    advanceHref = advanceParams.size ? `/memory-cards?${advanceParams}` : '/memory-cards'
  }

  const isFiltered =
    selectedIds.length > 0 ||
    Boolean(searchQuery) ||
    states.length > 0 ||
    maturity.length > 0 ||
    due.length > 0
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Memory cards"
      subtitle={pluralize(total, 'memory card')}
      actions={<ButtonLink href="/memory-cards/new">New card</ButtonLink>}
    >
      <div className="flex flex-col gap-12">
        {/* Streamed: the whole-deck card_overview RPC is decorative and must not block the review
          panel. The reserved-height Spinner box keeps the swap-in from shifting the layout below. */}
        <Suspense
          fallback={
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner className="size-10 [--spinner-w:4px]" />
            </div>
          }
        >
          <CardsOverviewSection />
        </Suspense>

        {/* Topic-scoped review: only when cards match the filters — a zero-match search shows the
          list's own empty state below. Clicking a list card sets `?review=<id>` and swaps it into
          this panel in place; with nothing due we show the soonest card anyway (review-ahead) under
          a caught-up note, so the user is never blocked from reviewing. The filter/due-count context
          rides in as the panel's subtitle. */}
        {total > 0 && (
          <div id={REVIEW_PANEL_ID} className="mx-auto w-full max-w-3xl scroll-mt-24">
            <ReviewCardTransition
              cardKey={reviewCard?.id ?? 'caught-up'}
              scrollOnMount={Boolean(resolvedSearchParams.review)}
            >
              <ReviewPanel
                card={reviewCard}
                goal={dailyGoal}
                showCardControls
                advanceHref={advanceHref}
                reviewingAhead={reviewingAhead}
              />
            </ReviewCardTransition>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {subjects.length > 0 && (
              <SubjectFilter
                options={options}
                selectedIds={selectedIds}
                triggerClassName="w-full"
              />
            )}
            <UrlMultiSelectFilter
              paramKey="state"
              options={FSRS_STATE_LABELS.map((label, i) => ({ value: String(i), label }))}
              selectedValues={states.map(String)}
              placeholder="State"
              searchable={false}
              triggerClassName="w-full"
            />
            <UrlMultiSelectFilter
              paramKey="maturity"
              options={MATURITY_OPTIONS}
              selectedValues={maturity}
              placeholder="Maturity"
              searchable={false}
              triggerClassName="w-full"
            />
            <UrlMultiSelectFilter
              paramKey="due"
              options={DUE_OPTIONS}
              selectedValues={due}
              placeholder="Due"
              searchable={false}
              triggerClassName="w-full"
            />
            <SearchFilterInput placeholder="Search memory cards…" className="sm:w-full" />
          </div>

          {total === 0 ? (
            <EmptyState
              message={
                isFiltered
                  ? 'No memory cards match your search.'
                  : 'No memory cards yet. Create one to start building your recall set.'
              }
              action={isFiltered ? undefined : { label: 'New card', href: '/memory-cards/new' }}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <MemoryCardsList cards={cards} subjects={subjects} />
              <PaginationFooter paginationMeta={paginationMeta} baseUrl="/memory-cards" />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
