import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { DeleteNoteButton } from '@/features/notes/delete-note-button'
import { NoteSubjectPicker } from '@/features/notes/components/note-subject-picker'
import { getNote } from '@/features/notes/queries'
import { getSubjects } from '@/features/subjects/queries'
import { getTopicChecksForNote } from '@/features/topic-checks/queries'
import { TopicChecksSection } from '@/features/topic-checks/topic-checks-section'

// Note detail. Server Component — first dynamic route in the repo (Next 16 `params` and
// `searchParams` are Promises). getNote() is RLS-scoped, so a missing OR not-owned id both
// 404. `?edit=<checkId>` drives the topic-check edit form (server-rendered, no client state).
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

  return (
    <PageShell
      title={note.title ?? 'Untitled'}
      subtitle={`Updated ${new Date(note.updated_at).toLocaleString()}`}
      width="prose"
      backHref="/notes"
      backLabel="Notes"
      actions={
        <>
          <Button asChild variant="outline" size="sm">
            <Link href={`/notes/${note.id}/edit`}>Edit</Link>
          </Button>
          <DeleteNoteButton id={note.id} />
        </>
      }
    >
      <NoteSubjectPicker noteId={note.id} currentSubjectId={note.subject_id} subjects={subjects} />

      <RenderMarkdown content={note.content} />

      <TopicChecksSection noteId={note.id} checks={topicChecks} editId={edit} />
    </PageShell>
  )
}
