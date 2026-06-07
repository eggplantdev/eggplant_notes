'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DeleteNoteDialog } from '@/features/notes/components/delete-note-dialog'

type DeleteNoteButtonPropsT = { id: string; redirectTo?: string }

// `redirectTo` forwards to the action — the subject view passes its /subjects/[id] so the docs
// context survives the delete.
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
