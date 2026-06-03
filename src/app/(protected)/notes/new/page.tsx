import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { createNote } from '@/features/notes/actions/create-note'
import { NoteForm } from '@/features/notes/note-form'

// Create page. Server Component hosting the client NoteForm island; passes the createNote
// Server Action down as a prop. Inherits the (protected) auth gate.
export default function NewNotePage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/notes">← Notes</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">New note</h1>
      <NoteForm action={createNote} />
    </main>
  )
}
