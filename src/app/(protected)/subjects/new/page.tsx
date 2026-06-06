import { PageShell } from '@/components/layout/page-shell'
import { createSubject } from '@/features/subjects/actions/create-subject'
import { SubjectForm } from '@/features/subjects/components/subject-form'

export default function NewSubjectPage() {
  return (
    <PageShell title="New subject" width="prose" backHref="/subjects" backLabel="Subjects">
      <SubjectForm action={createSubject} />
    </PageShell>
  )
}
