import { PageShell } from '@/components/layout/page-shell'
import { ButtonLink } from '@/components/ui/button-link'
import { EmptyState } from '@/components/ui/empty-state'
import { getSubjectsWithFirstNote } from '@/features/subjects/queries'
import { SubjectPicker } from '@/features/subjects/components/subject-picker'

// Landing page for the Subjects nav tab: a picker, not a redirect. It used to bounce into the first
// subject (which itself redirected to its first note) — two chained server redirects that flashed
// three loading fallbacks. Now it renders a select and lets the user choose; the options carry each
// subject's first note id so a pick lands straight on the note (one hop, not two). `delete-subject`
// also lands here, so deleting the current subject drops you on the picker rather than auto-advancing.
export default async function SubjectsPage() {
  const subjects = await getSubjectsWithFirstNote()

  return (
    <PageShell title="Subjects" width="prose">
      {subjects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <SubjectPicker subjects={subjects} />
          <ButtonLink href="/subjects/new" variant="outline">
            New subject
          </ButtonLink>
        </div>
      ) : (
        <EmptyState
          message="No subjects yet. Group your notes under one."
          action={{ label: 'Create your first subject', href: '/subjects/new' }}
        />
      )}
    </PageShell>
  )
}
