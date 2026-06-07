import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { ButtonLink } from '@/components/ui/button-link'
import { ContextLink } from '@/components/ui/context-link'
import { Separator } from '@/components/ui/separator'
import { updateNote } from '@/features/notes/actions/update-note'
import { DeleteNoteButton } from '@/features/notes/components/delete-note-button'
import { NoteForm } from '@/features/notes/components/note-form'
import { getNote } from '@/features/notes/queries'
import { getSubjects } from '@/features/subjects/queries'
import { getMemoryCardsForNote } from '@/features/memory-cards/queries'
import { MemoryCardsSection } from '@/features/memory-cards/components/memory-cards-section'
import { getOpenRouterDefaultModel, isOpenRouterConnected } from '@/features/openrouter/queries'
import { formatLocaleDateTime } from '@/lib/utils/date'

// Next 16 `params`/`searchParams` are Promises. getNote() is RLS-scoped, so a missing OR
// not-owned id both 404. `?edit=note` swaps the form in place (no client edit state — forced
// because RenderMarkdown is an async server-only Shiki component).
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  // Independent RLS-scoped reads run concurrently to avoid serial round-trips.
  const [note, memoryCards, subjects, aiEnabled, defaultModel] = await Promise.all([
    getNote(id),
    getMemoryCardsForNote(id),
    getSubjects(),
    isOpenRouterConnected(),
    getOpenRouterDefaultModel(),
  ])
  if (!note) notFound()

  const isEditingNote = edit === 'note'
  // Resolved from the already-fetched subjects list, so no extra round-trip.
  const subject = note.subject_id ? subjects.find((s) => s.id === note.subject_id) : undefined

  return (
    <PageShell
      // Edit mode shows "Edit note", not the title, which would duplicate NoteForm's title field.
      title={isEditingNote ? 'Edit note' : (note.title ?? 'Untitled')}
      eyebrow={
        !isEditingNote && subject ? (
          <ContextLink href={`/subjects/${subject.id}/${note.id}`}>
            Open in {subject.title}
          </ContextLink>
        ) : undefined
      }
      subtitle={isEditingNote ? undefined : `Updated ${formatLocaleDateTime(note.updated_at)}`}
      // Read and edit share "wide": the editor needs it for the write/preview grid, and the read
      // view is matched to the in-subject note pane so a note is the same width on either path.
      width="wide"
      backHistory
      backHref="/notes"
      backLabel="Back"
      actions={
        isEditingNote ? (
          <ButtonLink href={`/notes/${note.id}`} variant="outline" size="sm">
            Cancel
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href={`/notes/${note.id}?edit=note`} variant="outline" size="sm">
              Edit
            </ButtonLink>
            <DeleteNoteButton id={note.id} />
          </>
        )
      }
    >
      {isEditingNote ? (
        <NoteForm
          action={updateNote}
          note={note}
          subjects={subjects}
          linkedCards={memoryCards.map((c) => ({ id: c.id, prompt: c.prompt }))}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <RenderMarkdown content={note.content} />
        </div>
      )}

      {/* The gradient image paints over the Separator's bg-border. */}
      <Separator className="from-neon-green to-neon-cyan neon-glow bg-linear-to-r" />

      <MemoryCardsSection
        noteId={note.id}
        cards={memoryCards}
        aiEnabled={aiEnabled}
        defaultModel={defaultModel}
      />
    </PageShell>
  )
}
