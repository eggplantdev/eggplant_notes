import { PageShell } from '@/components/layout/page-shell'
import { ImportPanel } from '@/features/import/components/import-panel'
import { PromptDefaultsProvider } from '@/features/openrouter/components/prompt-defaults-context'
import { getOpenRouterStatus, getResolvedSystemPrompts } from '@/features/openrouter/queries'
import { getSubjects } from '@/features/subjects/queries'

export default async function ImportPage() {
  const [subjects, { connected: aiEnabled, defaultModel }, systemDefaults] = await Promise.all([
    getSubjects(),
    getOpenRouterStatus(),
    getResolvedSystemPrompts(),
  ])
  return (
    <PageShell
      title="Import notes"
      subtitle="Upload a markdown file or paste text, split it into notes, then commit."
      width="wide"
      backHref="/notes"
      backLabel="Notes"
    >
      <PromptDefaultsProvider value={systemDefaults}>
        <ImportPanel subjects={subjects} aiEnabled={aiEnabled} defaultModel={defaultModel} />
      </PromptDefaultsProvider>
    </PageShell>
  )
}
