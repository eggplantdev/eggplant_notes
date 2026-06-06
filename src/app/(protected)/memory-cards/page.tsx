import { PageShell } from '@/components/layout/page-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { TitledCard } from '@/components/ui/titled-card'
import { CardsOverview } from '@/features/memory-cards/components/cards-overview'
import { MemoryCardsList } from '@/features/memory-cards/components/memory-cards-list'
import { getCardsForStats, getMemoryCardsList } from '@/features/memory-cards/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

// Memory cards list. Server Component — RLS scopes the reads to the signed-in user; the (protected)
// layout already gates auth. Mirrors NotesPage: reads `?subjects=` (filter, joined through notes),
// `?q=` (search across prompt+answer text), and `?page=`; the list query composes them and returns
// one slim paginated page + the full match `total`. The "Cards overview" chart is the ONE exception
// to the filtered/paginated view — it reads the ENTIRE deck via getCardsForStats (ignores
// q/page/subjects), so it stays a stable whole-deck dashboard. Empty state keys off `total === 0`.
// No "new" action — cards are created from a note's detail view.
export default async function MemoryCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ subjects?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const selectedIds = (sp.subjects ?? '').split(',').filter(Boolean)
  const q = sp.q ?? ''
  const { page, limit } = parsePagination(sp)
  const [subjects, { rows: cards, total }, statsCards] = await Promise.all([
    getSubjects(),
    getMemoryCardsList({ subjectIds: selectedIds, q, page, limit }),
    getCardsForStats(),
  ])
  const isFiltered = selectedIds.length > 0 || Boolean(q)
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Memory cards"
      subtitle={pluralize(total, 'memory card')}
      // 'full' (the dashboard's width) so the card grid can fan out to three columns on wide screens.
      width="full"
    >
      {statsCards.length > 0 && (
        <TitledCard title="Cards overview">
          <CardsOverview cards={statsCards} />
        </TitledCard>
      )}

      {(total > 0 || isFiltered) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SearchFilterInput placeholder="Search memory cards…" />
          {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          message={
            isFiltered
              ? 'No memory cards match your search.'
              : 'No memory cards yet. Add one from a note to start building your recall set.'
          }
          action={isFiltered ? undefined : { label: 'Go to notes', href: '/notes' }}
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
