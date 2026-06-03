import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { updateNote } from '@/features/notes/actions/update-note'
import { NoteForm } from '@/features/notes/note-form'
import { getNote } from '@/features/notes/queries'
import { getSubjects } from '@/features/subjects/queries'

// Edit page. Async Server Component (Next 16 `params` is a Promise); getNote() is
// RLS-scoped, so a missing OR not-owned id 404s. Pre-fills the form via the `note` prop and
// passes the user's subjects for the assignment picker.
export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [note, subjects] = await Promise.all([getNote(id), getSubjects()])
  if (!note) notFound()

  return (
    <PageShell title="Edit note" width="wide" backHref={`/notes/${note.id}`} backLabel="Note">
      <NoteForm action={updateNote} note={note} subjects={subjects} />
    </PageShell>
  )
}
