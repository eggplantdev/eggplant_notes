import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { MutedText } from '@/components/ui/muted-text'
import { Separator } from '@/components/ui/separator'
import { SubjectNoteSidebar } from '@/features/subjects/components/subject-note-sidebar'
import { DeleteSubjectButton } from '@/features/subjects/delete-subject-button'
import { getSubject, getSubjectNoteSummaries } from '@/features/subjects/queries'
import { pluralize } from '@/lib/utils/pluralize'

// This layout holds the persistent shell + header/sidebar; the nested [noteId] segment renders
// the active note's body, so a sidebar click is a soft RSC navigation that streams only the
// content pane. The layout+segment split is forced by RenderMarkdown being async/server-only — a
// client swap can't call it. Subject editing (?edit) lives in page.tsx since layouts get no searchParams.
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
      subtitle={
        <>
          <span className="block">{pluralize(summaries.length, 'note')}</span>
          <MutedText as="span" className="mt-1 block max-w-prose">
            {subject.description}
          </MutedText>
        </>
      }
      backHref="/subjects"
      backLabel="Subjects"
      width="full"
      fill
      actions={
        <>
          <ButtonLink href={`/notes/new?subject=${id}`} size="sm">
            New note
          </ButtonLink>
          <ButtonLink href={`/subjects/${id}?edit`} variant="outline" size="sm">
            Edit
          </ButtonLink>
          <DeleteSubjectButton id={id} />
        </>
      }
    >
      <Separator className="my-2" />

      {/* Single 1fr track so the sidebar and content pane each scroll on their own
          (md:overflow-y-auto below) while the page itself never scrolls. */}
      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]">
        <SubjectNoteSidebar subjectId={id} notes={summaries} />
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">{children}</div>
      </div>
    </PageShell>
  )
}
