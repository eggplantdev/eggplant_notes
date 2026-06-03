import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
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
    <PageShell
      title="Edit subject"
      width="prose"
      backHref={`/subjects/${subject.id}`}
      backLabel="Subject"
    >
      <SubjectForm action={updateSubject} subject={subject} />
    </PageShell>
  )
}
