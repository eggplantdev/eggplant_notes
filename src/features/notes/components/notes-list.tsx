'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import type { NoteListItemT } from '@/features/notes/types'

// Thin client wrapper over the shared AnimatedCardList: supplies the notes-specific href,
// title fallback, and a subtitle of the note's subject ("topic") chip + created-at date. Data
// is fetched on the server (NotesPage) and passed in; this stays a client component only so it
// can hand render functions to the list.
export function NotesList({ notes }: { notes: NoteListItemT[] }) {
  return (
    <AnimatedCardList
      items={notes}
      getKey={(note) => note.id}
      getHref={(note) => `/notes/${note.id}`}
      renderTitle={(note) => note.title ?? 'Untitled'}
      renderSubtitle={(note) => (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {note.subjects?.title && (
            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-medium">
              {note.subjects.title}
            </span>
          )}
          <span>{new Date(note.created_at).toLocaleDateString()}</span>
        </div>
      )}
    />
  )
}
