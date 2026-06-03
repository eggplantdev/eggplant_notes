import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { NotesList } from '@/features/notes/components/notes-list'
import { getNotes } from '@/features/notes/queries'

// Notes list. Server Component — RLS scopes getNotes() to the signed-in user; the
// (protected) layout already gates auth. Newest-first, with an empty-state CTA. The list
// rows are rendered by the NotesList client island so they can animate.
export default async function NotesPage() {
  const notes = await getNotes()

  return (
    <PageShell
      title="Notes"
      width="prose"
      actions={
        <Button asChild>
          <Link href="/notes/new">New note</Link>
        </Button>
      }
    >
      {notes.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No notes yet. Capture your first one.</p>
          <Button asChild variant="outline">
            <Link href="/notes/new">Create a note</Link>
          </Button>
        </div>
      ) : (
        <NotesList notes={notes} />
      )}
    </PageShell>
  )
}
