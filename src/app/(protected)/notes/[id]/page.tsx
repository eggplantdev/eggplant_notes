import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { updateNote } from '@/features/notes/actions/update-note'
import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { NoteForm } from '@/features/notes/note-form'
import { getNote } from '@/features/notes/queries'
import { getSubjects } from '@/features/subjects/queries'
import { getTopicChecksForNote } from '@/features/topic-checks/queries'
import { TopicChecksSection } from '@/features/topic-checks/topic-checks-section'

// Note detail. Server Component — first dynamic route in the repo (Next 16 `params` and
// `searchParams` are Promises). getNote() is RLS-scoped, so a missing OR not-owned id both
// 404. `?edit` carries two mutually exclusive meanings: `note` swaps the body+subject into
// NoteForm in place (the old /notes/[id]/edit route, now inline); `<checkId>` drives the
// topic-check edit form. Both are server-rendered (no client edit state) — forced because
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
  // round-trips in series (the wasted checks query on a 404 is one rare extra query).
  const [note, topicChecks, subjects] = await Promise.all([
    getNote(id),
    getTopicChecksForNote(id),
    getSubjects(),
  ])
  if (!note) notFound()

  const isEditingNote = edit === 'note'

  return (
    <PageShell
      // Edit mode mirrors the deleted /notes/[id]/edit route: "Edit note" label (not the
      // doc title, which would duplicate NoteForm's own title field) and the wider editor
      // width for the side-by-side write/preview grid.
      title={isEditingNote ? 'Edit note' : (note.title ?? 'Untitled')}
      subtitle={isEditingNote ? undefined : `Updated ${new Date(note.updated_at).toLocaleString()}`}
      width={isEditingNote ? 'wide' : 'prose'}
      backHref="/notes"
      backLabel="Notes"
      actions={
        isEditingNote ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/notes/${note.id}`}>Cancel</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/notes/${note.id}?edit=note`}>Edit</Link>
            </Button>
            <DeleteNoteButton id={note.id} />
          </>
        )
      }
    >
      {isEditingNote ? (
        <NoteForm action={updateNote} note={note} subjects={subjects} />
      ) : (
        // Read view: subject is shown/changed only in edit mode (NoteForm's Combobox), so the
        // read branch is just the rendered body — no inline subject picker.
        <RenderMarkdown content={note.content} />
      )}

      {/* `note` is the body-edit sentinel — never a check id. Forwarding it as editId would
          trip TopicChecksSection's stale-?edit guard (no check has id `note`) and bounce the
          user out of body-edit, so suppress it while editing the body. */}
      <TopicChecksSection
        noteId={note.id}
        checks={topicChecks}
        editId={isEditingNote ? undefined : edit}
      />
    </PageShell>
  )
}
