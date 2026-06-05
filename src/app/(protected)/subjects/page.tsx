import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
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
      actions={
        <Button asChild>
          <Link href="/subjects/new">New subject</Link>
        </Button>
      }
    >
      {subjects.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
          <p>No subjects yet. Group your notes under one.</p>
          <Button asChild variant="outline">
            <Link href="/subjects/new">Create a subject</Link>
          </Button>
        </div>
      ) : (
        <SubjectsList subjects={subjects} />
      )}
    </PageShell>
  )
}
