import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { NotesList } from '@/features/notes/components/notes-list'
import { getNotes } from '@/features/notes/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { pluralize } from '@/lib/utils/pluralize'

// Notes list. Server Component — RLS scopes both reads to the signed-in user; the (protected)
// layout already gates auth. `?subjects=a,b` filters the list by subject ("topic") server-side
// (re-queried on change), and the subject set also feeds the filter's options. Newest-first,
// with empty states for both "no notes at all" and "no notes match the filter".
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ subjects?: string }>
}) {
  const { subjects: subjectsParam } = await searchParams
  const selectedIds = (subjectsParam ?? '').split(',').filter(Boolean)
  const [subjects, notes] = await Promise.all([
    getSubjects(),
    getNotes({ subjectIds: selectedIds }),
  ])
  const isFiltered = selectedIds.length > 0
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))

  return (
    <PageShell
      title="Notes"
      // Count reflects the post-filter result set (`notes` is already filtered by `?subjects=`).
      subtitle={pluralize(notes.length, 'note')}
      // 'full' (the dashboard's width) so the card grid can fan out to three columns on wide screens.
      width="full"
      actions={<ButtonLink href="/notes/new">New note</ButtonLink>}
    >
      {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}

      {notes.length === 0 ? (
        <EmptyState
          message={
            isFiltered
              ? 'No notes match the selected subjects.'
              : 'No notes yet. Capture your first one.'
          }
          action={isFiltered ? undefined : { label: 'Create a note', href: '/notes/new' }}
        />
      ) : (
        <NotesList notes={notes} />
      )}
    </PageShell>
  )
}
