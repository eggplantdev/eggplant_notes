import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { updateSubject } from '@/features/subjects/actions/update-subject'
import { getSubject } from '@/features/subjects/queries'
import { SubjectForm } from '@/features/subjects/subject-form'

// Edit page. Async Server Component (Next 16 `params` is a Promise); getSubject() is
// RLS-scoped, so a missing OR not-owned id 404s. Pre-fills the form via the `subject` prop.
export default async function EditSubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const subject = await getSubject(id)
  if (!subject) notFound()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/subjects/${subject.id}`}>← Subject</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Edit subject</h1>
      <SubjectForm action={updateSubject} subject={subject} />
    </main>
  )
}
