import { PageShell } from '@/components/layout/page-shell'
import { createNote } from '@/features/notes/actions/create-note'
import { NoteForm } from '@/features/notes/note-form'
import { getSubjects } from '@/features/subjects/queries'

// Create page. Server Component hosting the client NoteForm island; passes the createNote
// Server Action + the user's subjects (for the assignment picker) down as props. Inherits
// the (protected) auth gate. `?subject=<id>` (from a subject's "New note" entry point)
// pre-selects that subject — validated against the user's own subjects so a forged id is
// silently ignored rather than pre-selecting something unowned.
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>
}) {
  const [subjects, { subject }] = await Promise.all([getSubjects(), searchParams])
  const defaultSubjectId = subjects.some((s) => s.id === subject) ? subject : undefined
  return (
    <PageShell title="New note" width="wide" backHref="/notes" backLabel="Notes">
      <NoteForm action={createNote} subjects={subjects} defaultSubjectId={defaultSubjectId} />
    </PageShell>
  )
}
