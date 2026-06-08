import { PageShell } from '@/components/layout/page-shell'
import { createNote } from '@/features/notes/actions/create-note'
import { NoteForm } from '@/features/notes/components/note-form'
import { getOpenRouterStatus, getResolvedSystemPrompts } from '@/features/openrouter/queries'
import { getSubjects } from '@/features/subjects/queries'

// `?subject=<id>` pre-selects that subject — validated against the user's own subjects so a forged
// id is silently ignored rather than pre-selecting something unowned.
export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>
}) {
  const [subjects, { subject }, { connected: aiEnabled, defaultModel }, systemDefaults] =
    await Promise.all([
      getSubjects(),
      searchParams,
      getOpenRouterStatus(),
      getResolvedSystemPrompts(),
    ])
  const defaultSubjectId = subjects.some((s) => s.id === subject) ? subject : undefined
  return (
    <PageShell title="New note" width="wide" backHref="/notes" backLabel="Notes">
      <NoteForm
        action={createNote}
        subjects={subjects}
        defaultSubjectId={defaultSubjectId}
        aiEnabled={aiEnabled}
        defaultModel={defaultModel}
        systemDefaults={systemDefaults}
      />
    </PageShell>
  )
}
