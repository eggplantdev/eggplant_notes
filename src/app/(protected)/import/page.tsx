import { PageShell } from '@/components/layout/page-shell'
import { ImportPanel } from '@/features/import/components/import-panel'
import { isOpenRouterConnected } from '@/features/openrouter/queries'
import { getSubjects } from '@/features/subjects/queries'

export default async function ImportPage() {
  const [subjects, aiEnabled] = await Promise.all([getSubjects(), isOpenRouterConnected()])
  return (
    <PageShell
      title="Import notes"
      subtitle="Upload a markdown file or paste text, split it into notes, then commit."
      width="wide"
      backHref="/notes"
      backLabel="Notes"
    >
      <ImportPanel subjects={subjects} aiEnabled={aiEnabled} />
    </PageShell>
  )
}
