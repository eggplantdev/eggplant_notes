import { PageShell } from '@/components/layout/page-shell'
import { ImportPanel } from '@/features/import/components/import-panel'
import { getSubjects } from '@/features/subjects/queries'

export default async function ImportPage() {
  const subjects = await getSubjects()
  return (
    <PageShell
      title="Import notes"
      subtitle="Upload a markdown file or paste text, split it into notes, then commit."
      width="wide"
      backHref="/notes"
      backLabel="Notes"
    >
      <ImportPanel subjects={subjects} />
    </PageShell>
  )
}
