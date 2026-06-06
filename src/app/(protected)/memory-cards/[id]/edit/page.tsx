import { notFound } from 'next/navigation'

import { PageShell } from '@/components/layout/page-shell'
import { CardForm } from '@/features/memory-cards/card-form'
import { getMemoryCard } from '@/features/memory-cards/queries'
import { getSubjects } from '@/features/subjects/queries'

// getMemoryCard is RLS-scoped, so a missing OR not-owned id both 404. The embedded source note
// (when present) drives CardForm's Unlink affordance. Next 16 `params` is a Promise.
export default async function EditMemoryCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [card, subjects] = await Promise.all([getMemoryCard(id), getSubjects()])
  if (!card) notFound()

  const sourceNote = card.notes ?? undefined
  return (
    <PageShell title="Edit card" width="wide" backHref="/memory-cards" backLabel="Memory cards">
      <CardForm subjects={subjects} card={card} sourceNote={sourceNote} />
    </PageShell>
  )
}
