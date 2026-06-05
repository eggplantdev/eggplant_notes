'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DeleteSubjectDialog } from '@/features/subjects/delete-subject-dialog'

type DeleteSubjectButtonPropsT = { id: string }

// Destructive control on the subject page: a trigger button plus its own DeleteSubjectDialog
// instance (the dialog + deleteSubject logic live there, shared with the subjects list's single
// shared dialog). Local open-state maps to the dialog's controlled `subjectId`. Mirrors
// DeleteNoteButton. Member notes are DETACHED, not deleted (FK set null); deleteSubject
// redirects to /subjects on success.
export function DeleteSubjectButton({ id }: DeleteSubjectButtonPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <DeleteSubjectDialog subjectId={open ? id : null} onOpenChange={setOpen} />
    </>
  )
}
