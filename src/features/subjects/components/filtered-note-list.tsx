'use client'

import { NoteNavLink } from '@/features/subjects/components/note-nav-link'
import type { SubjectNoteSummaryT } from '@/features/subjects/types'

type FilteredNoteListPropsT = {
  subjectId: string
  items: SubjectNoteSummaryT[]
  activeNoteId: string | undefined
  onNavigate?: () => void
}

// Reorder is intentionally OFF while filtering: dragging a filtered SUBSET would compute
// fractional positions against the wrong neighbors (the hidden rows between two visible ones),
// so the only coherent options are full-list-draggable OR filtered-static.
export function FilteredNoteList({
  subjectId,
  items,
  activeNoteId,
  onNavigate,
}: FilteredNoteListPropsT) {
  return (
    <ul className="flex flex-col gap-0.5 pl-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center">
          <NoteNavLink
            subjectId={subjectId}
            id={i.id}
            title={i.title}
            isActive={i.id === activeNoteId}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  )
}
