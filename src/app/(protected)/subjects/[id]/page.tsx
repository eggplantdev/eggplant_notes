import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RenderMarkdown } from '@/components/markdown/render-markdown'
import { Button } from '@/components/ui/button'
import { DeleteSubjectButton } from '@/features/subjects/delete-subject-button'
import { getNotesForSubject, getSubject } from '@/features/subjects/queries'

// Subject-as-document view. Server Component (Next 16 `params` is a Promise). Renders every
// member note in user-defined order as one continuous Shiki-highlighted document; each
// section is headed by the note title linking to its own editable page, so notes stay
// individually addressable. Independent RLS-scoped reads run concurrently; a missing or
// not-owned subject 404s.
export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [subject, notes] = await Promise.all([getSubject(id), getNotesForSubject(id)])
  if (!subject) notFound()

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/subjects">← Subjects</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/subjects/${subject.id}/edit`}>Edit</Link>
          </Button>
          <DeleteSubjectButton id={subject.id} />
        </div>
      </div>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{subject.title}</h1>
        {subject.description && (
          <p className="text-muted-foreground text-sm">{subject.description}</p>
        )}
      </header>

      {notes.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No notes in this subject yet. Assign one from its note page.</p>
          <Button asChild variant="outline">
            <Link href="/notes">Go to notes</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
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
    </main>
  )
}
