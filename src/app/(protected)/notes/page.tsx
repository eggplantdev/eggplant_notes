import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getNotes } from '@/features/notes/queries'

// Notes list. Server Component — RLS scopes getNotes() to the signed-in user; the
// (protected) layout already gates auth. Newest-first, with an empty-state CTA.
export default async function NotesPage() {
  const notes = await getNotes()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <Button asChild>
          <Link href="/notes/new">New note</Link>
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No notes yet. Capture your first one.</p>
          <Button asChild variant="outline">
            <Link href="/notes/new">Create a note</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Link href={`/notes/${note.id}`}>
                <Card className="hover:border-ring transition-colors">
                  <CardHeader>
                    <CardTitle>{note.title ?? 'Untitled'}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
