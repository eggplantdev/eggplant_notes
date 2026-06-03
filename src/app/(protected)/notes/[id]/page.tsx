import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { getNote } from '@/features/notes/queries'
import { RenderMarkdown } from '@/features/notes/render-markdown'

// Note detail. Server Component — first dynamic route in the repo (Next 16 `params` is a
// Promise). getNote() is RLS-scoped, so a missing OR not-owned id both 404. The delete
// control lands in Phase 4.
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await getNote(id)
  if (!note) notFound()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/notes">← Notes</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/notes/${note.id}/edit`}>Edit</Link>
          </Button>
          <DeleteNoteButton id={note.id} />
        </div>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{note.title ?? 'Untitled'}</h1>
        <p className="text-muted-foreground text-sm">
          Updated {new Date(note.updated_at).toLocaleString()}
        </p>
      </header>

      <RenderMarkdown content={note.content} />
    </main>
  )
}
