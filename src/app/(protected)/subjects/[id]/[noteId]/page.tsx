import { notFound } from 'next/navigation'

import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { ButtonLink } from '@/components/ui/button-link'
import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { getNote } from '@/features/notes/queries'

// Active-note content pane. Server-renders the selected note's read-only body via the
// async/server-only RenderMarkdown — this is the segment that swaps (and streams) on each
// sidebar click while the layout/sidebar persist. Read-only by design: editing links out to
// the standalone note page (/notes/[id]?edit=note). getNote is RLS-scoped so a missing/
// not-owned id 404s; the subject_id guard also 404s a note reached via the wrong subject path.
export default async function SubjectReadNote({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>
}) {
  const { id, noteId } = await params
  const note = await getNote(noteId)
  if (!note || note.subject_id !== id) notFound()

  return (
    // max-w-4xl mirrors PageShell's 'wide' width on the standalone note page, so a note reads
    // at the same measure in-subject as on /notes/[id]; mx-auto centers it in the content track.
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{note.title ?? 'Untitled'}</h2>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/notes/${note.id}?edit=note`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <DeleteNoteButton id={note.id} redirectTo={`/subjects/${id}`} />
        </div>
      </header>
      <RenderMarkdown content={note.content} />
    </article>
  )
}
