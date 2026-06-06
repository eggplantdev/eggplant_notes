import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { SubjectsList } from '@/features/subjects/components/subjects-list'
import { getSubjectsList } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

// Subjects list. Server Component — RLS scopes getSubjectsList() to the signed-in user; the
// (protected) layout gates auth. Reads `?q=` (search across title+description) and `?page=`; the
// query returns one slim paginated page + the full match `total`. Mirrors NotesPage; the list rows
// are rendered by the SubjectsList client island so they can animate. Empty state keys off
// `total === 0` so an out-of-range deep page still renders the footer.
export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const { page, limit } = parsePagination(sp)
  const { rows: subjects, total } = await getSubjectsList({ q, page, limit })
  const isFiltered = Boolean(q)
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Subjects"
      subtitle={pluralize(total, 'subject')}
      width="prose"
      actions={<ButtonLink href="/subjects/new">New subject</ButtonLink>}
    >
      {(total > 0 || isFiltered) && <SearchFilterInput placeholder="Search subjects…" />}

      {total === 0 ? (
        <EmptyState
          message={
            isFiltered
              ? 'No subjects match your search.'
              : 'No subjects yet. Group your notes under one.'
          }
          action={isFiltered ? undefined : { label: 'Create a subject', href: '/subjects/new' }}
        />
      ) : (
        <>
          <SubjectsList subjects={subjects} />
          <PaginationFooter paginationMeta={paginationMeta} baseUrl="/subjects" />
        </>
      )}
    </PageShell>
  )
}
