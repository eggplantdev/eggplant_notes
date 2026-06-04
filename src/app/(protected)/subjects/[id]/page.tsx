import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { updateSubject } from '@/features/subjects/actions/update-subject'
import { DeleteSubjectButton } from '@/features/subjects/delete-subject-button'
import { getNotesForSubject, getSubject } from '@/features/subjects/queries'
import { ReorderableNoteList } from '@/features/subjects/reorderable-note-list'
import { SubjectForm } from '@/features/subjects/subject-form'

// Subject-as-document view. Server Component (Next 16 `params`/`searchParams` are Promises).
// Renders every member note in user-defined order as one continuous Shiki-highlighted
// document; each section is headed by the note title linking to its own editable page, so
// notes stay individually addressable. `?edit` swaps the title/description header into
// SubjectForm in place (the old /subjects/[id]/edit route, now inline) — server-driven, no
// client edit state. Independent RLS-scoped reads run concurrently; a missing or not-owned
// subject 404s.
export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const { edit } = await searchParams
  const [subject, notes] = await Promise.all([getSubject(id), getNotesForSubject(id)])
  if (!subject) notFound()

  // `?edit` is value-less here (one meaning, unlike the note page) — presence alone toggles
  // edit mode, so a bare `?edit` (empty string) still counts.
  const isEditing = edit !== undefined

  return (
    <PageShell
      // Edit mode mirrors the deleted /subjects/[id]/edit route: "Edit subject" label (not the
      // subject title, which would duplicate SubjectForm's own title field) and no subtitle.
      title={isEditing ? 'Edit subject' : subject.title}
      subtitle={isEditing ? undefined : (subject.description ?? undefined)}
      width="prose"
      backHref="/subjects"
      backLabel="Subjects"
      actions={
        isEditing ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/subjects/${subject.id}`}>Cancel</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="sm">
              <Link href={`/notes/new?subject=${subject.id}`}>New note</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/subjects/${subject.id}?edit`}>Edit</Link>
            </Button>
            <DeleteSubjectButton id={subject.id} />
          </>
        )
      }
    >
      {isEditing && <SubjectForm action={updateSubject} subject={subject} />}

      {notes.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No notes in this subject yet.</p>
          <Button asChild>
            <Link href={`/notes/new?subject=${subject.id}`}>New note</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <ReorderableNoteList
            notes={notes.map((note) => ({
              id: note.id,
              title: note.title ?? 'Untitled',
              position: note.position ?? 0,
            }))}
          />
          {notes.map((note) => (
            <section key={note.id} className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">
                <Link href={`/notes/${note.id}`} className="hover:underline">
                  {note.title ?? 'Untitled'}
                </Link>
              </h2>
              <RenderMarkdown content={note.content} />
            </section>
          ))}
        </div>
      )}
    </PageShell>
  )
}
