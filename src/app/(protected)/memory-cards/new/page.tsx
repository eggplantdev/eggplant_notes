import { PageShell } from '@/components/layout/page-shell'
import { CardForm } from '@/features/memory-cards/card-form'
import { getSubjects } from '@/features/subjects/queries'

// Standalone create page (standalone-memory-cards). Server Component hosting the client CardForm
// island; passes the user's subjects for the optional assignment picker. Inherits the (protected)
// auth gate. The explainer names the two ways to make a card so the standalone path doesn't read
// as the only one.
export default async function NewMemoryCardPage() {
  const subjects = await getSubjects()
  return (
    <PageShell title="New card" width="wide" backHref="/memory-cards" backLabel="Memory cards">
      <p className="text-muted-foreground mb-4 text-sm">
        Two ways to make a card: attach one to a note via that note&apos;s “Add card”, or create a
        standalone card here — optionally filed under a topic.
      </p>
      <CardForm subjects={subjects} />
    </PageShell>
  )
}
