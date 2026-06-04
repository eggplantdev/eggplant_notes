'use client'

import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

// Per-card Edit + Delete actions for the notes list (AnimatedCardList's renderAction slot).
// The slot wraps this in a nav-neutralizing container, so the buttons just act. Delete doesn't
// own a dialog — it requests deletion via `onRequestDelete`, and NotesList opens its single
// shared DeleteNoteDialog for the chosen id (one dialog for the whole list, not one per row).
type NoteCardActionsPropsT = {
  noteId: string
  onRequestDelete: (noteId: string) => void
}

export function NoteCardActions({ noteId, onRequestDelete }: NoteCardActionsPropsT) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => router.push(`/notes/${noteId}?edit=note`)}>
        Edit
      </Button>
      <Button variant="destructive" size="sm" onClick={() => onRequestDelete(noteId)}>
        Delete
      </Button>
    </div>
  )
}
