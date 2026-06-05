import Link from 'next/link'

import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { TopicChecksList } from '@/features/topic-checks/components/topic-checks-list'
import { getTopicChecksList } from '@/features/topic-checks/queries'
import { SubjectFilter } from '@/features/subjects/components/subject-filter'
import { getSubjects } from '@/features/subjects/queries'
import { pluralize } from '@/lib/utils/pluralize'

// Topic-checks list. Server Component — RLS scopes both reads to the signed-in user; the
// (protected) layout already gates auth. Mirrors NotesPage: `?subjects=a,b` filters server-side by
// subject (joining through notes — see getTopicChecksList), and the subject set feeds the filter's
// options. Soonest-due first, with empty states for "no checks at all" and "none match the filter".
// No "new" action — checks are created from a note's detail view.
export default async function TopicChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ subjects?: string }>
}) {
  const { subjects: subjectsParam } = await searchParams
  const selectedIds = (subjectsParam ?? '').split(',').filter(Boolean)
  const [subjects, checks] = await Promise.all([
    getSubjects(),
    getTopicChecksList({ subjectIds: selectedIds }),
  ])
  const isFiltered = selectedIds.length > 0
  const options = subjects.map((subject) => ({ value: subject.id, label: subject.title }))

  return (
    <PageShell
      title="Topic checks"
      // Count reflects the post-filter result set (`checks` is already filtered by `?subjects=`).
      subtitle={pluralize(checks.length, 'topic check')}
      // 'full' (the dashboard's width) so the card grid can fan out to three columns on wide screens.
      width="full"
    >
      {subjects.length > 0 && <SubjectFilter options={options} selectedIds={selectedIds} />}

      {checks.length === 0 ? (
        isFiltered ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-8">
            <p>No topic checks match the selected subjects.</p>
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border border-dashed p-8">
            <p>No topic checks yet. Add one from a note to start building your recall set.</p>
            <Button asChild variant="outline">
              <Link href="/notes">Go to notes</Link>
            </Button>
          </div>
        )
      ) : (
        <TopicChecksList checks={checks} />
      )}
    </PageShell>
  )
}
