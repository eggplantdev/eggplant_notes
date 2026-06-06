import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { SubjectsList } from '@/features/subjects/components/subjects-list'
import { getSubjects } from '@/features/subjects/queries'
import { pluralize } from '@/lib/utils/pluralize'

// Subjects list. Server Component — RLS scopes getSubjects() to the signed-in user; the
// (protected) layout gates auth. Newest-first, with an empty-state CTA. Mirrors NotesPage;
// the list rows are rendered by the SubjectsList client island so they can animate.
export default async function SubjectsPage() {
  const subjects = await getSubjects()

  return (
    <PageShell
      title="Subjects"
      subtitle={pluralize(subjects.length, 'subject')}
      width="prose"
      actions={<ButtonLink href="/subjects/new">New subject</ButtonLink>}
    >
      {subjects.length === 0 ? (
        <EmptyState
          message="No subjects yet. Group your notes under one."
          action={{ label: 'Create a subject', href: '/subjects/new' }}
        />
      ) : (
        <SubjectsList subjects={subjects} />
      )}
    </PageShell>
  )
}
