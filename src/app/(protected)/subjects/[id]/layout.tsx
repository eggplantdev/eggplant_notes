import type { ReactNode } from 'react'

import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { MutedText } from '@/components/ui/muted-text'
import { Separator } from '@/components/ui/separator'
import { SubjectNoteSidebar } from '@/features/subjects/components/subject-note-sidebar'
import { SubjectSwitcher } from '@/features/subjects/components/subject-switcher'
import { DeleteSubjectButton } from '@/features/subjects/components/delete-subject-button'
import { getSubject, getSubjectNoteSummaries, getSubjects } from '@/features/subjects/queries'
import { assertFound } from '@/lib/assert-found'
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
  const [subject, summaries, subjects] = await Promise.all([
    getSubject(id),
    getSubjectNoteSummaries(id),
    getSubjects(),
  ])
  assertFound(subject)

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
      width="full"
      fill
    >
      {/* Full-width toolbar: select on the left, subject/note actions pushed to the right edge.
          Lives here (not PageShell's header) because that header column hugs its content, so
          justify-between there can't spread. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubjectSwitcher subjects={subjects} currentId={id} />
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/subjects/new">New subject</ButtonLink>
          <ButtonLink href={`/subjects/${id}?edit`} variant="outline">
            Edit subject
          </ButtonLink>
          <DeleteSubjectButton id={id} />
          <ButtonLink href={`/notes/new?subject=${id}`}>Add note</ButtonLink>
        </div>
      </div>

      <Separator className="my-2" />

      {/* Track priority: the content node is the capped minmax track, the sidebar is the fr track.
          Grid maximizes non-fr tracks (the node, up to 64rem) BEFORE expanding fr tracks (the
          sidebar), so the node grows first and never shrinks below 36rem; the sidebar only widens
          past 15rem once the node has hit its ceiling. Each pane scrolls on its own
          (md:overflow-y-auto below) while the page itself never scrolls. */}
      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(15rem,1fr)_minmax(36rem,64rem)] md:grid-rows-[minmax(0,1fr)]">
        <div className="flex flex-col gap-2 md:min-h-0">
          <SubjectNoteSidebar subjectId={id} notes={summaries} />
        </div>
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">{children}</div>
      </div>
    </PageShell>
  )
}
