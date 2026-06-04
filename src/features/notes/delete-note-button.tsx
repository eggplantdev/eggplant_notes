'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DeleteNoteDialog } from '@/features/notes/delete-note-dialog'

type DeleteNoteButtonPropsT = { id: string; redirectTo?: string }

// Destructive control on the detail page (FR-010): a trigger button plus its own
// DeleteNoteDialog instance (the dialog + deleteNote logic live there, shared with the notes
// list's single shared dialog). Local open-state maps to the dialog's controlled `noteId`.
// `redirectTo` forwards to the action — the S-15 subject view passes its /subjects/[id] so the
// docs context survives the delete.
export function DeleteNoteButton({ id, redirectTo }: DeleteNoteButtonPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <DeleteNoteDialog noteId={open ? id : null} onOpenChange={setOpen} redirectTo={redirectTo} />
    </>
  )
}
