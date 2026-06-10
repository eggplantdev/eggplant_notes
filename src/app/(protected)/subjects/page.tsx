import { redirect } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getSubjects } from '@/features/subjects/queries'

// No longer a list — the in-detail subject switcher replaced it. Redirect into the first subject's
// detail; with zero subjects, offer to create one. `delete-subject` redirects here, so deleting the
// current subject lands on the next remaining one (or this empty state when none are left).
export default async function SubjectsPage() {
  const subjects = await getSubjects()
  if (subjects.length > 0) redirect(`/subjects/${subjects[0].id}`)

  return (
    <PageShell title="Subjects" width="prose">
      <EmptyState
        message="No subjects yet. Group your notes under one."
        action={{ label: 'Create your first subject', href: '/subjects/new' }}
      />
    </PageShell>
  )
}
