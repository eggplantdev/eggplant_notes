'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DeleteSubjectDialog } from '@/features/subjects/components/delete-subject-dialog'

type DeleteSubjectButtonPropsT = { id: string }

export function DeleteSubjectButton({ id }: DeleteSubjectButtonPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="glowy-red" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <DeleteSubjectDialog subjectId={open ? id : null} onOpenChange={setOpen} />
    </>
  )
}
