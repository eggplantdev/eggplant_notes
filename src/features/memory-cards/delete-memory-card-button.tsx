'use client'

import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { deleteMemoryCard } from '@/features/memory-cards/actions/delete-memory-card'
import { useActionTransition } from '@/hooks/use-action-transition'

type DeleteMemoryCardButtonPropsT = { id: string; noteId?: string }

// Destructive control per row (FR-014). Owns its own trigger Button + open state (the shared
// ConfirmDeleteDialog is controlled-only, no built-in trigger), then fires the deleteMemoryCard
// Server Action inside a transition. The action revalidates the note's detail path, so on success
// the row disappears and the dialog unmounts with it; a returned failure is surfaced inline and
// the dialog stays open (the shared dialog suppresses close while pending). The card's
// review_events cascade at the DB.
export function DeleteMemoryCardButton({ id, noteId }: DeleteMemoryCardButtonPropsT) {
  const [open, setOpen] = useState(false)
  const { error, isPending, run } = useActionTransition()

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this memory card?"
        description="This permanently deletes the memory card and its review history. This can’t be undone."
        isPending={isPending}
        error={error}
        onConfirm={() =>
          run(() => deleteMemoryCard(id, noteId), { successMessage: 'Card deleted' })
        }
      />
    </>
  )
}
