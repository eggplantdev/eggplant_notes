import { notFound, redirect } from 'next/navigation'

import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { updateSubject } from '@/features/subjects/actions/update-subject'
import { getSubject, getSubjectNoteSummaries } from '@/features/subjects/queries'
import { SubjectForm } from '@/features/subjects/components/subject-form'

// `?edit` renders the inline subject edit form here (not the layout, which gets no searchParams).
// Otherwise redirect to the first note so the content pane is never empty. `?toast` is forwarded
// onto that redirect so a post-delete/-save toast survives the hop.
export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string; toast?: string }>
}) {
  const { id } = await params
  const { edit, toast } = await searchParams

  if (edit !== undefined) {
    const subject = await getSubject(id)
    if (!subject) notFound()
    return (
      <div className="flex flex-col gap-4">
        <SubjectForm action={updateSubject} subject={subject} />
        <ButtonLink href={`/subjects/${id}`} variant="ghost" size="sm" className="self-start">
          Cancel
        </ButtonLink>
      </div>
    )
  }

  const summaries = await getSubjectNoteSummaries(id)
  if (summaries.length > 0) {
    const query = toast ? `?toast=${toast}` : ''
    redirect(`/subjects/${id}/${summaries[0].id}${query}`)
  }

  return (
    <EmptyState
      message="No notes in this subject yet."
      action={{ label: 'New note', href: `/notes/new?subject=${id}`, variant: 'default' }}
    />
  )
}
