import { PageShell } from '@/components/layout/page-shell'
import { MutedText } from '@/components/ui/muted-text'
import { CardForm } from '@/features/memory-cards/card-form'
import { getSubjects } from '@/features/subjects/queries'

// Standalone create page (standalone-memory-cards). Server Component hosting the client CardForm
// island; passes the user's subjects for the optional assignment picker. Inherits the (protected)
// auth gate. `wide` matches the New Note editor — the code-context editor + preview render
// side by side and need the room.
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
