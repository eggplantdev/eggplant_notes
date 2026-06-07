import { PageShell } from '@/components/layout/page-shell'
import { MutedText } from '@/components/ui/muted-text'
import { CardForm } from '@/features/memory-cards/components/card-form'
import { getOpenRouterDefaultModel, isOpenRouterConnected } from '@/features/openrouter/queries'
import { getSubjects } from '@/features/subjects/queries'

// `wide` matches the New Note editor — the code-context editor + preview render side by side.
export default async function NewMemoryCardPage() {
  const [subjects, aiEnabled, defaultModel] = await Promise.all([
    getSubjects(),
    isOpenRouterConnected(),
    getOpenRouterDefaultModel(),
  ])
  return (
    <PageShell title="New card" width="wide" backHref="/memory-cards" backLabel="Memory cards">
      <MutedText className="mb-4">
        A standalone card, optionally filed under a topic. You can also add cards from a note.
      </MutedText>
      <CardForm subjects={subjects} aiEnabled={aiEnabled} defaultModel={defaultModel} />
    </PageShell>
  )
}
