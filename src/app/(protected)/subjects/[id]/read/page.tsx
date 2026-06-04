import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { getSubjectNoteSummaries } from '@/features/subjects/queries'

// Index of the read view: with notes, redirect to the first one (by position order) so the
// content pane is never empty; with none, render an empty prompt in the content slot. Subject
// existence is the layout's concern (it 404s), so this only decides first-note vs empty.
// `?toast` is forwarded onto the first-note redirect so a post-delete toast (deleteNote lands
// here) survives this server hop; on the empty branch it stays in the URL for <ActionToast>.
export default async function SubjectReadIndex({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ toast?: string }>
}) {
  const { id } = await params
  const { toast } = await searchParams
  const summaries = await getSubjectNoteSummaries(id)

  if (summaries.length > 0) {
    const query = toast ? `?toast=${toast}` : ''
    redirect(`/subjects/${id}/read/${summaries[0].id}${query}`)
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
