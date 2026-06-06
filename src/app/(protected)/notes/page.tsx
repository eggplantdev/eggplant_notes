import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { NotesList } from '@/features/notes/components/notes-list'
import { getNotes } from '@/features/notes/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

// Notes list. Server Component — RLS scopes both reads to the signed-in user; the (protected)
// layout already gates auth. Reads `?subjects=a,b` (filter), `?q=` (search across title+content),
// and `?page=` from the URL; the query composes them server-side and returns one slim paginated
// page + the full match `total`. The subtitle count and the footer both read `total`, not the page
// length. Empty state keys off `total === 0` so an out-of-range deep page still renders the footer
// to navigate back.
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ subjects?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const selectedIds = (sp.subjects ?? '').split(',').filter(Boolean)
  const q = sp.q ?? ''
  const { page, limit } = parsePagination(sp)
  const [subjects, { rows: notes, total }] = await Promise.all([
    getSubjects(),
    getNotes({ subjectIds: selectedIds, q, page, limit }),
  ])
  const isFiltered = selectedIds.length > 0 || Boolean(q)
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))
  const paginationMeta = buildPaginationMeta(total, page, limit)

  return (
    <PageShell
      title="Notes"
      subtitle={pluralize(total, 'note')}
      // 'full' (the dashboard's width) so the card grid can fan out to three columns on wide screens.
      width="full"
      actions={<ButtonLink href="/notes/new">New note</ButtonLink>}
    >
      {(total > 0 || isFiltered) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SearchFilterInput placeholder="Search notes…" />
          {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          message={
            isFiltered ? 'No notes match your search.' : 'No notes yet. Capture your first one.'
          }
          action={isFiltered ? undefined : { label: 'Create a note', href: '/notes/new' }}
        />
      ) : (
        <>
          <NotesList notes={notes} />
          <PaginationFooter paginationMeta={paginationMeta} baseUrl="/notes" />
        </>
      )}
    </PageShell>
  )
}
