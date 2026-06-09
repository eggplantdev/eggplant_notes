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
import { getCardOverview, getDueQueue, getMemoryCardsList } from '@/features/memory-cards/queries'
import { parseCardFilters } from '@/features/memory-cards/utils'
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
  }>
}) {
  const sp = await searchParams
  const selectedIds = (sp.subjects ?? '').split(',').filter(Boolean)
  const q = sp.q ?? ''
  const { states, maturity } = parseCardFilters(sp)
  const { page, limit } = parsePagination(sp)
  const [
    subjects,
    { rows: cards, total },
    overview,
    { first: dueCard, count: dueCount },
    dailyGoal,
  ] = await Promise.all([
    getSubjects(),
    getMemoryCardsList({ subjectIds: selectedIds, q, states, maturity, page, limit }),
    getCardOverview(),
    // Same filters as the listing → the review panel is scoped to the active topic.
    getDueQueue({ subjectIds: selectedIds, q, states, maturity }),
    getDailyGoal(),
  ])
  const isFiltered =
    selectedIds.length > 0 || Boolean(q) || states.length > 0 || maturity.length > 0
  const reviewDescription =
    (isFiltered ? 'Reviewing due cards that match your filters' : 'Reviewing all due cards') +
    (dueCount > 0 ? ` · ${pluralize(dueCount, 'card')} due` : '')
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Memory cards"
      subtitle={pluralize(total, 'memory card')}
      // 'full' so the card grid can fan out to three columns on wide screens.
      width="full"
      actions={<ButtonLink href="/memory-cards/new">New card</ButtonLink>}
    >
      {overview.total > 0 && (
        <TitledCard title="Cards overview">
          <CardsOverview overview={overview} />
        </TitledCard>
      )}

      {(total > 0 || isFiltered) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SearchFilterInput placeholder="Search memory cards…" />
          {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}
          <UrlMultiSelectFilter
            paramKey="state"
            options={FSRS_STATE_LABELS.map((label, i) => ({ value: String(i), label }))}
            selectedValues={states.map(String)}
            placeholder="State"
            searchPlaceholder="Search states…"
            emptyMessage="No states found."
          />
          <UrlMultiSelectFilter
            paramKey="maturity"
            options={MATURITY_OPTIONS}
            selectedValues={maturity}
            placeholder="Maturity"
            searchPlaceholder="Search maturity…"
            emptyMessage="No options found."
          />
        </div>
      )}

      {/* Topic-scoped review: only when cards match the filters — a zero-match search shows the
          list's own empty state below, not a misleading "caught up". When cards exist but none are
          due, ReviewPanel's CaughtUpNotice branch renders. */}
      {total > 0 && (
        <TitledCard title="Review" description={reviewDescription}>
          <ReviewPanel card={dueCard} goal={dailyGoal} />
        </TitledCard>
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
        <>
          <MemoryCardsList cards={cards} />
          <PaginationFooter paginationMeta={paginationMeta} baseUrl="/memory-cards" />
        </>
      )}
    </PageShell>
  )
}
