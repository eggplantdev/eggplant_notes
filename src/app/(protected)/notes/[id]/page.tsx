import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { ButtonLink } from '@/components/ui/button-link'
import { ContextLink } from '@/components/ui/context-link'
import { Separator } from '@/components/ui/separator'
import { updateNote } from '@/features/notes/actions/update-note'
import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { NoteForm } from '@/features/notes/note-form'
import { getNote } from '@/features/notes/queries'
import { getSubjects } from '@/features/subjects/queries'
import { getMemoryCardsForNote } from '@/features/memory-cards/queries'
import { MemoryCardsSection } from '@/features/memory-cards/memory-cards-section'
import { formatLocaleDateTime } from '@/lib/utils/date'

// Note detail. Server Component — first dynamic route in the repo (Next 16 `params` and
// `searchParams` are Promises). getNote() is RLS-scoped, so a missing OR not-owned id both
// 404. `?edit=note` swaps the body+subject into NoteForm in place (the old /notes/[id]/edit
// route, now inline); editing a card lives at the unified /memory-cards/[id]/edit route
// (standalone-memory-cards). Server-rendered (no client edit state) — forced because
// RenderMarkdown is an async server-only Shiki component.
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  // Independent RLS-scoped reads — run them concurrently rather than paying two
  // round-trips in series (the wasted cards query on a 404 is one rare extra query).
  const [note, memoryCards, subjects] = await Promise.all([
    getNote(id),
    getMemoryCardsForNote(id),
    getSubjects(),
  ])
  if (!note) notFound()

  const isEditingNote = edit === 'note'
  // The note's surrounding subject (if assigned) — drives the "open in subject" context link.
  // Resolved from the already-fetched subjects list, so no extra round-trip.
  const subject = note.subject_id ? subjects.find((s) => s.id === note.subject_id) : undefined

  return (
    <PageShell
      // Edit mode mirrors the deleted /notes/[id]/edit route: "Edit note" label (not the
      // doc title, which would duplicate NoteForm's own title field) and the wider editor
      // width for the side-by-side write/preview grid.
      title={isEditingNote ? 'Edit note' : (note.title ?? 'Untitled')}
      // Read view only: a contextual link above the title to open the note inside its subject.
      eyebrow={
        !isEditingNote && subject ? (
          <ContextLink href={`/subjects/${subject.id}/${note.id}`}>
            Open in {subject.title}
          </ContextLink>
        ) : undefined
      }
      subtitle={isEditingNote ? undefined : `Updated ${formatLocaleDateTime(note.updated_at)}`}
      // Read and edit share the wider width: the editor needs it for the side-by-side
      // write/preview grid, and the read view is intentionally matched to the in-subject
      // note pane (subjects/[id]/[noteId]) so a note is the same width on either path.
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
        // Read view: subject is changed only in edit mode (NoteForm's Combobox). The "Open in
        // <subject>" context link now sits above the title (PageShell `eyebrow`).
        <div className="flex flex-col gap-4">
          <RenderMarkdown content={note.content} />
        </div>
      )}

      {/* Glowy teal rule between the note body and its cards — the aurora progress-bar palette
          (neon-green→cyan gradient + cyan glow). The gradient image paints over bg-border. */}
      <Separator className="from-neon-green to-neon-cyan neon-glow bg-linear-to-r" />

      <MemoryCardsSection noteId={note.id} cards={memoryCards} />
    </PageShell>
  )
}
