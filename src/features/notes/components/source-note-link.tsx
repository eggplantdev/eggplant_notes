import { ContextLink } from '@/components/ui/context-link'

type PropsT = {
  noteId: string
  // null for unassigned notes. Those have no /subjects/[id]/[noteId] route to target, so the
  // link falls back to the bare /notes/[noteId] page — the one case the destinations differ.
  // The fallback lives here so every caller inherits the same rule.
  subjectId: string | null
  title: string
  className?: string
}

// A card → source-note link: opens the note in its subject context when assigned, else the bare
// note page (see subjectId). Used by the review panel; renders the shared ContextLink so it
// matches the other in-context links stylistically.
export function SourceNoteLink({ noteId, subjectId, title, className }: PropsT) {
  const href = subjectId ? `/subjects/${subjectId}/${noteId}` : `/notes/${noteId}`
  return (
    <ContextLink href={href} className={className}>
      From: {title}
    </ContextLink>
  )
}
