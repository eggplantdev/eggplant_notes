import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { SubjectNoteSidebar } from '@/features/subjects/components/subject-note-sidebar'
import { DeleteSubjectButton } from '@/features/subjects/delete-subject-button'
import { getSubject, getSubjectNoteSummaries } from '@/features/subjects/queries'

// Docs-style single-pane subject view (S-15) — now THE subject view (replaced the continuous
// "subject-as-document" page). This layout holds the persistent shell + subject header/actions
// + sidebar; the nested [noteId] segment server-renders just the active note's read-only body,
// so clicking a sidebar link is a soft RSC navigation that streams only the content pane (the
// layout, and thus the sidebar, never re-render). The layout+segment split is forced by
// RenderMarkdown being async/server-only — a client `?note=` swap can't call it. Subject editing
// (?edit) lives in the index page (page.tsx) since layouts don't receive searchParams.
export default async function SubjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [subject, summaries] = await Promise.all([getSubject(id), getSubjectNoteSummaries(id)])
  if (!subject) notFound()

  return (
    <PageShell
      title={subject.title}
      subtitle={subject.description ?? undefined}
      backHref="/subjects"
      backLabel="Subjects"
      width="full"
      fill
      actions={
        <>
          <Button asChild size="sm">
            <Link href={`/notes/new?subject=${id}`}>New note</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/subjects/${id}?edit`}>Edit</Link>
          </Button>
          <DeleteSubjectButton id={id} />
        </>
      }
    >
      {/* App-shell row (desktop): fills the bounded <main> (PageShell `fill`) and gives the grid
          a single 1fr track, so the sidebar column and the content pane each scroll on their own
          (md:overflow-y-auto below) while the page itself never scrolls. */}
      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
        <SubjectNoteSidebar subjectId={id} notes={summaries} />
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">{children}</div>
      </div>
    </PageShell>
  )
}
