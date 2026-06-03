import { PageShell } from '@/components/layout/page-shell'
import { createNote } from '@/features/notes/actions/create-note'
import { NoteForm } from '@/features/notes/note-form'
import { getSubjects } from '@/features/subjects/queries'

// Create page. Server Component hosting the client NoteForm island; passes the createNote
// Server Action + the user's subjects (for the assignment picker) down as props. Inherits
// the (protected) auth gate.
export default async function NewNotePage() {
  const subjects = await getSubjects()
  return (
    <PageShell title="New note" width="wide" backHref="/notes" backLabel="Notes">
      <NoteForm action={createNote} subjects={subjects} />
    </PageShell>
  )
}
