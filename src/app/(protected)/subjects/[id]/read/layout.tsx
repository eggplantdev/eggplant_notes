import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { SubjectNoteSidebar } from '@/features/subjects/components/subject-note-sidebar'
import { getSubject, getSubjectNoteSummaries } from '@/features/subjects/queries'

// Docs-style single-pane subject view (S-15) — a SEPARATE route from the continuous
// /subjects/[id] document, kept alongside it for A/B comparison. This layout holds the
// persistent shell + sidebar; the nested [noteId] segment server-renders just the active
// note's read-only body, so clicking a sidebar link is a soft RSC navigation that streams
// only the content pane (the layout, and thus the sidebar, never re-renders). The
// layout+segment split is forced by RenderMarkdown being async/server-only — a client
// `?note=` swap can't call it. Phase 1 lists notes as plain server-rendered links; Phase 2
// swaps in the client dnd island (handle-split reorder + active highlight + mobile sheet).
export default async function SubjectReadLayout({
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
    <PageShell title={subject.title} backHref="/subjects" backLabel="Subjects" width="full">
      <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
        <SubjectNoteSidebar subjectId={id} notes={summaries} />
        <div className="min-w-0">{children}</div>
      </div>
    </PageShell>
  )
}
