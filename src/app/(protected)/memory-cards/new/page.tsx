import { PageShell } from '@/components/layout/page-shell'
import { MutedText } from '@/components/ui/muted-text'
import { CardForm } from '@/features/memory-cards/components/card-form'
import { getSubjects } from '@/features/subjects/queries'

// `wide` matches the New Note editor — the code-context editor + preview render side by side.
export default async function NewMemoryCardPage() {
  const subjects = await getSubjects()
  return (
    <PageShell title="New card" width="wide" backHref="/memory-cards" backLabel="Memory cards">
      <MutedText className="mb-4">
        A standalone card, optionally filed under a topic. You can also add cards from a note.
      </MutedText>
      <CardForm subjects={subjects} />
    </PageShell>
  )
}
