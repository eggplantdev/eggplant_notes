import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { UrlMultiSelectFilter } from '@/components/ui/url-multi-select-filter'
import { MemoryCardsList } from '@/features/memory-cards/components/memory-cards-list'
import { DUE_OPTIONS, FSRS_STATE_LABELS, MATURITY_OPTIONS } from '@/features/memory-cards/constants'
import { getMemoryCardsList, type CardFilterOptsT } from '@/features/memory-cards/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

type PropsT = {
  filters: CardFilterOptsT
  page: number
  limit: number
}

// Everything below the overview chart, streamed behind <Suspense>: the filter row, the card count,
// the paginated grid, and the empty state. Fetches subjects (for the subject filter + the per-row
// link dialog) alongside the count-exact list query, so NONE of this — filters included — sits on
// the page's fast path. The card count lives here (moved off the page header) so the fast path never
// needs the list `total`.
export async function MemoryCardsListSection({ filters, page, limit }: PropsT) {
  const [subjects, { rows: cards, total }] = await Promise.all([
    getSubjects(),
    getMemoryCardsList({ ...filters, page, limit }),
  ])
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const isFiltered =
    (filters.subjectIds?.length ?? 0) > 0 ||
    Boolean(filters.q) ||
    (filters.states?.length ?? 0) > 0 ||
    (filters.maturity?.length ?? 0) > 0 ||
    (filters.due?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {subjects.length > 0 && (
          <SubjectFilter
            options={options}
            selectedIds={filters.subjectIds ?? []}
            triggerClassName="w-full"
          />
        )}
        <UrlMultiSelectFilter
          paramKey="state"
          options={FSRS_STATE_LABELS.map((label, i) => ({ value: String(i), label }))}
          selectedValues={(filters.states ?? []).map(String)}
          placeholder="State"
          searchable={false}
          triggerClassName="w-full"
        />
        <UrlMultiSelectFilter
          paramKey="maturity"
          options={MATURITY_OPTIONS}
          selectedValues={filters.maturity ?? []}
          placeholder="Maturity"
          searchable={false}
          triggerClassName="w-full"
        />
        <UrlMultiSelectFilter
          paramKey="due"
          options={DUE_OPTIONS}
          selectedValues={filters.due ?? []}
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
        <>
          <p className="text-muted-foreground text-sm">{pluralize(total, 'memory card')}</p>
          <MemoryCardsList cards={cards} subjects={subjects} />
          <PaginationFooter
            paginationMeta={buildPaginationMeta(total, page, limit)}
            baseUrl="/memory-cards"
          />
        </>
      )}
    </div>
  )
}
