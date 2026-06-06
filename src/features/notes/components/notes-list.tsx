'use client'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { CardActions } from '@/components/ui/card-actions'
import { DeleteNoteDialog } from '@/features/notes/delete-note-dialog'
import type { NoteListItemT } from '@/features/notes/types'
import { useDeleteDialogState } from '@/hooks/use-delete-dialog-state'
import { formatLocaleDate } from '@/lib/utils/date'

// Thin client wrapper over the shared AnimatedCardList: supplies the notes-specific href,
// title fallback, a subtitle of the note's subject ("topic") chip + created-at date, and the
// per-card Edit/Delete actions. Data is fetched on the server (NotesPage) and passed in; this
// stays a client component only so it can hand render functions to the list.
//
// Delete uses ONE shared DeleteNoteDialog driven by the pending-delete id (not a Radix dialog
// per card). `openId` derives from the pending id AND its presence in `notes`, so once the
// delete revalidates the list (the row drops out) the dialog closes on its own — no effect.
export function NotesList({ notes }: { notes: NoteListItemT[] }) {
  const { openId, requestDelete, onOpenChange } = useDeleteDialogState(notes)

  return (
    <>
      <AnimatedCardList
        gridLayout
        items={notes}
        getKey={(note) => note.id}
        getHref={(note) => `/notes/${note.id}`}
        renderTitle={(note) => note.title ?? 'Untitled'}
        renderEyebrow={(note) => (
          <span className="text-muted-foreground text-xs">{formatLocaleDate(note.created_at)}</span>
        )}
        renderAction={(note) => (
          <CardActions
            editHref={`/notes/${note.id}?edit=note`}
            onRequestDelete={() => requestDelete(note.id)}
          />
        )}
        renderSubtitle={(note) =>
          note.subjects?.title ? (
            <span className="bg-muted text-foreground line-clamp-1 w-fit max-w-full rounded px-1.5 py-0.5 text-xs font-medium">
              {note.subjects.title}
            </span>
          ) : null
        }
      />
      <DeleteNoteDialog noteId={openId} onOpenChange={onOpenChange} />
    </>
  )
}
