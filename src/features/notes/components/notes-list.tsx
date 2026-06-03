'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import type { NoteT } from '@/types/note'

// Thin client wrapper over the shared AnimatedCardList: supplies the notes-specific href,
// title fallback, and created-at subtitle. Data is fetched on the server (NotesPage) and
// passed in; this stays a client component only so it can hand render functions to the list.
export function NotesList({ notes }: { notes: NoteT[] }) {
  return (
    <AnimatedCardList
      items={notes}
      getKey={(note) => note.id}
      getHref={(note) => `/notes/${note.id}`}
      renderTitle={(note) => note.title ?? 'Untitled'}
      renderSubtitle={(note) => (
        <p className="text-muted-foreground text-sm">
          {new Date(note.created_at).toLocaleDateString()}
        </p>
      )}
    />
  )
}
