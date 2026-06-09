import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { NotesList } from '@/features/notes/components/notes-list'
import { getNotes } from '@/features/notes/queries'
import { LoadSampleDataButton } from '@/features/sample-data/components/load-sample-data-button'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { buildPaginationMeta, parsePagination } from '@/lib/utils/pagination'
import { pluralize } from '@/lib/utils/pluralize'

// `total` is the full match count (subtitle + footer), not the page length; empty state keys off
// `total === 0` so an out-of-range deep page still renders the footer to navigate back.
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
      // 'full' so the card grid can fan out to three columns on wide screens.
      width="full"
      actions={
        <>
          <ButtonLink href="/import" variant="outline">
            Import notes
          </ButtonLink>
          <ButtonLink href="/notes/new">New note</ButtonLink>
        </>
      }
    >
      {(total > 0 || isFiltered) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SearchFilterInput placeholder="Search notes…" />
          {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}
        </div>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyState
            message={
              isFiltered ? 'No notes match your search.' : 'No notes yet. Capture your first one.'
            }
            action={isFiltered ? undefined : { label: 'Create a note', href: '/notes/new' }}
          />
          {/* Brand-new account only: offer the demo dataset beside the create CTA. */}
          {!isFiltered && subjects.length === 0 && <LoadSampleDataButton variant="outline" />}
        </div>
      ) : (
        <>
          <NotesList notes={notes} />
          <PaginationFooter paginationMeta={paginationMeta} baseUrl="/notes" />
        </>
      )}
    </PageShell>
  )
}
