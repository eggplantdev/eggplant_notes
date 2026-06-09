'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { LinkCardToNoteDialog } from '@/features/memory-cards/components/link-card-to-note-dialog'
import type { SubjectOptionT } from '@/features/subjects/types'

type LinkCardButtonPropsT = {
  cardId: string
  cardSubjectId: string | null
  subjects: SubjectOptionT[]
}

// Trigger + mounted-while-open LinkCardToNoteDialog. Shared by the cards listing, the card view
// page, and the edit form — each renders it ONLY for an unlinked card. The dialog mounts only while
// open so its selection state starts fresh on every open.
export function LinkCardButton({ cardId, cardSubjectId, subjects }: LinkCardButtonPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="card-link-note"
        onClick={() => setOpen(true)}
      >
        Link
      </Button>
      {open && (
        <LinkCardToNoteDialog
          cardId={cardId}
          cardSubjectId={cardSubjectId}
          subjects={subjects}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}
