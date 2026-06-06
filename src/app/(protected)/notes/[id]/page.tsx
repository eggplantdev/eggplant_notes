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
// 404. `?edit` carries two mutually exclusive meanings: `note` swaps the body+subject into
// NoteForm in place (the old /notes/[id]/edit route, now inline); `<checkId>` drives the
// memory-card edit form. Both are server-rendered (no client edit state) — forced because
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
        <NoteForm action={updateNote} note={note} subjects={subjects} />
      ) : (
        // Read view: subject is changed only in edit mode (NoteForm's Combobox). When the note is
        // assigned, surface a link that opens it inside its subject context (the sidebar pane).
        <div className="flex flex-col gap-4">
          {subject && (
            <ContextLink href={`/subjects/${subject.id}/${note.id}`}>
              Open in {subject.title}
            </ContextLink>
          )}
          <RenderMarkdown content={note.content} />
        </div>
      )}

      <Separator />

      {/* `note` is the body-edit sentinel — never a card id. Forwarding it as editId would
          trip MemoryCardsSection's stale-?edit guard (no card has id `note`) and bounce the
          user out of body-edit, so suppress it while editing the body. */}
      <MemoryCardsSection
        noteId={note.id}
        cards={memoryCards}
        editId={isEditingNote ? undefined : edit}
      />
    </PageShell>
  )
}
