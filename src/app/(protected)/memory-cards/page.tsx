import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { TitledCard } from '@/components/ui/titled-card'
import { UrlMultiSelectFilter } from '@/components/ui/url-multi-select-filter'
import { CardsOverview } from '@/features/memory-cards/components/cards-overview'
import { MemoryCardsList } from '@/features/memory-cards/components/memory-cards-list'
import { FSRS_STATE_LABELS, MATURITY_OPTIONS } from '@/features/memory-cards/constants'
import {
  getCardOverview,
  getDueQueue,
  getMemoryCardForReview,
  getMemoryCardsList,
  getSoonestReviewCard,
} from '@/features/memory-cards/queries'
import { parseCardFilters } from '@/features/memory-cards/utils'
import { REVIEW_PANEL_ID } from '@/features/review/constants'
import { ReviewCardTransition } from '@/features/review/components/review-card-transition'
import { ReviewPanel } from '@/features/review/components/review-panel'
import { getDailyGoal } from '@/features/settings/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

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
    page?: string
    // The card the in-place review panel is showing. Clicking a list card sets it; absent → the
    // panel falls back to the soonest-due card, then (nothing due) the soonest card overall.
    review?: string
  }>
}) {
  const sp = await searchParams
  const selectedIds = (sp.subjects ?? '').split(',').filter(Boolean)
  const q = sp.q ?? ''
  const { states, maturity } = parseCardFilters(sp)
  const { page, limit } = parsePagination(sp)
  const filters = { subjectIds: selectedIds, q, states, maturity }
  const [
    subjects,
    { rows: cards, total },
    overview,
    { first: dueCard, count: dueCount },
    dailyGoal,
  ] = await Promise.all([
    getSubjects(),
    getMemoryCardsList({ ...filters, page, limit }),
    getCardOverview(),
    // Same filters as the listing → the review panel is scoped to the active topic.
    getDueQueue(filters),
    getDailyGoal(),
  ])

  // The card to review, in priority: an explicitly clicked card (due or not) → the soonest-due card
  // → the soonest card overall so the user can keep reviewing ahead when nothing is due.
  const selectedCard = sp.review ? await getMemoryCardForReview(sp.review) : undefined
  let reviewCard = selectedCard ?? dueCard
  if (!reviewCard) reviewCard = await getSoonestReviewCard(filters)
  // Showing a not-due card because nothing is due (vs. nothing due AND no cards at all).
  const reviewingAhead = dueCount === 0 && Boolean(reviewCard)

  // After a rating, RatingButtons replaces to this (filters minus `review`) so the selection clears
  // and the next card surfaces.
  const advanceParams = new URLSearchParams()
  for (const key of ['subjects', 'q', 'state', 'maturity', 'page'] as const) {
    if (sp[key]) advanceParams.set(key, sp[key])
  }
  const advanceHref = advanceParams.size ? `/memory-cards?${advanceParams}` : '/memory-cards'

  const isFiltered =
    selectedIds.length > 0 || Boolean(q) || states.length > 0 || maturity.length > 0
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Memory cards"
      subtitle={pluralize(total, 'memory card')}
      width="full"
      actions={<ButtonLink href="/memory-cards/new">New card</ButtonLink>}
    >
      {/* Bigger, even spacing between the page's major sections (PageShell's own gap is the page
          default); the list + its pagination stay tight as one section in their own group below. */}
      <div className="flex flex-col gap-12">
        {overview.total > 0 && (
          <TitledCard title="Cards overview">
            <CardsOverview overview={overview} />
          </TitledCard>
        )}

        {/* Topic-scoped review: only when cards match the filters — a zero-match search shows the
          list's own empty state below. Clicking a list card sets `?review=<id>` and swaps it into
          this panel in place; with nothing due we show the soonest card anyway (review-ahead) under
          a caught-up note, so the user is never blocked from reviewing. The filter/due-count context
          rides in as the panel's subtitle. */}
        {total > 0 && (
          // The page is width="full" for the card grid; cap the review panel so it stays a
          // comfortable reading width instead of stretching across the whole deck width. id anchors the
          // per-card Review button's smooth-scroll target.
          <div id={REVIEW_PANEL_ID} className="mx-auto w-full max-w-3xl scroll-mt-24">
            {reviewingAhead && (
              <p className="text-muted-foreground mb-4 text-center text-sm">
                All caught up 🎉 — reviewing ahead.
              </p>
            )}
            <ReviewCardTransition cardKey={reviewCard?.id ?? 'caught-up'}>
              <ReviewPanel
                card={reviewCard}
                goal={dailyGoal}
                showCardControls
                advanceHref={advanceHref}
              />
            </ReviewCardTransition>
          </div>
        )}

        {/* The filters and the card list are one section ("Cards"), so they sit at the standard gap
            from each other — only the major sections above use the bigger gap-12. */}
        <div className="flex flex-col gap-6">
          {(total > 0 || isFiltered) && (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <SearchFilterInput placeholder="Search memory cards…" />
              {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}
              <UrlMultiSelectFilter
                paramKey="state"
                options={FSRS_STATE_LABELS.map((label, i) => ({ value: String(i), label }))}
                selectedValues={states.map(String)}
                placeholder="State"
                searchable={false}
              />
              <UrlMultiSelectFilter
                paramKey="maturity"
                options={MATURITY_OPTIONS}
                selectedValues={maturity}
                placeholder="Maturity"
                searchable={false}
              />
            </div>
          )}

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
