'use client'

import { useState } from 'react'

import { AnimatedCardList } from '@/components/motion/animated-card-list'
import { NoteCardActions } from '@/features/notes/components/note-card-actions'
import { DeleteNoteDialog } from '@/features/notes/delete-note-dialog'
import type { NoteListItemT } from '@/features/notes/types'

// Thin client wrapper over the shared AnimatedCardList: supplies the notes-specific href,
// title fallback, a subtitle of the note's subject ("topic") chip + created-at date, and the
// per-card Edit/Delete actions. Data is fetched on the server (NotesPage) and passed in; this
// stays a client component only so it can hand render functions to the list.
//
// Delete uses ONE shared DeleteNoteDialog driven by the pending-delete id (not a Radix dialog
// per card). `openId` derives from the pending id AND its presence in `notes`, so once the
// delete revalidates the list (the row drops out) the dialog closes on its own — no effect.
export function NotesList({ notes }: { notes: NoteListItemT[] }) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const openId =
    pendingDeleteId && notes.some((n) => n.id === pendingDeleteId) ? pendingDeleteId : null

  return (
    <>
      <AnimatedCardList
        items={notes}
        getKey={(note) => note.id}
        getHref={(note) => `/notes/${note.id}`}
        renderTitle={(note) => note.title ?? 'Untitled'}
        renderAction={(note) => (
          <NoteCardActions noteId={note.id} onRequestDelete={setPendingDeleteId} />
        )}
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
      <DeleteNoteDialog
        noteId={openId}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      />
    </>
  )
}
