import { PageShell } from '@/components/layout/page-shell'
import { createSubject } from '@/features/subjects/actions/create-subject'
import { SubjectForm } from '@/features/subjects/subject-form'

// Create page. Server Component hosting the client SubjectForm island; passes createSubject
// down as a prop. Inherits the (protected) auth gate.
export default function NewSubjectPage() {
  return (
    <PageShell title="New subject" width="prose" backHref="/subjects" backLabel="Subjects">
      <SubjectForm action={createSubject} />
    </PageShell>
  )
}
