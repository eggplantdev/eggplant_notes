import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
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

// The "Cards overview" chart is the ONE exception to the filtered/paginated view — it reads the
// ENTIRE deck via getCardsForStats (ignores q/page/subjects), so it stays a stable whole-deck stat.
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
      // 'full' so the card grid can fan out to three columns on wide screens.
      width="full"
      actions={<ButtonLink href="/memory-cards/new">New card</ButtonLink>}
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
