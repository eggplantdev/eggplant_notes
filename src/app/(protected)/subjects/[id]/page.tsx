import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { updateSubject } from '@/features/subjects/actions/update-subject'
import { getSubject, getSubjectNoteSummaries } from '@/features/subjects/queries'
import { SubjectForm } from '@/features/subjects/subject-form'

// Index of the subject view. `?edit` renders the inline subject edit form (carried over from
// S-14 — layouts can't read searchParams, so it lives here, not the layout). Otherwise: with
// notes, redirect to the first (by position) so the content pane is never empty; with none, an
// empty prompt. Subject existence is also enforced by the layout (404s). `?toast` is forwarded
// onto the first-note redirect so a post-delete/-save toast survives this hop; on the empty/edit
// branches it stays in the URL for the global <ActionToast> mounted in the root layout.
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
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href={`/subjects/${id}`}>Cancel</Link>
        </Button>
      </div>
    )
  }

  const summaries = await getSubjectNoteSummaries(id)
  if (summaries.length > 0) {
    const query = toast ? `?toast=${toast}` : ''
    redirect(`/subjects/${id}/${summaries[0].id}${query}`)
  }

  return (
    <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
      <p>No notes in this subject yet.</p>
      <Button asChild>
        <Link href={`/notes/new?subject=${id}`}>New note</Link>
      </Button>
    </div>
  )
}
