import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { updateNote } from '@/features/notes/actions/update-note'
import { NoteForm } from '@/features/notes/note-form'
import { getNote } from '@/features/notes/queries'

// Edit page. Async Server Component (Next 16 `params` is a Promise); getNote() is
// RLS-scoped, so a missing OR not-owned id 404s. Pre-fills the form via the `note` prop.
export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await getNote(id)
  if (!note) notFound()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/notes/${note.id}`}>← Note</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Edit note</h1>
      <NoteForm action={updateNote} note={note} />
    </main>
  )
}
