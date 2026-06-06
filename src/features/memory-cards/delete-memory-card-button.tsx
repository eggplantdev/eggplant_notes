'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { deleteMemoryCard } from '@/features/memory-cards/actions/delete-memory-card'
import { useActionTransition } from '@/hooks/use-action-transition'

// `redirectTo` is for deleting a card while ON its own detail page: revalidating the listing isn't
// enough — the current route now points at a deleted row, so it must navigate away. List rows omit
// it and rely on the revalidate making the row vanish.
type DeleteMemoryCardButtonPropsT = { id: string; noteId?: string; redirectTo?: string }

// Owns its own trigger Button + open state (the shared ConfirmDeleteDialog is controlled-only).
export function DeleteMemoryCardButton({ id, noteId, redirectTo }: DeleteMemoryCardButtonPropsT) {
  const router = useRouter()
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
          run(() => deleteMemoryCard(id, noteId), { successMessage: 'Card deleted' }).then(
            (result) => {
              if (result.success && redirectTo) router.push(redirectTo)
            },
          )
        }
      />
    </>
  )
}
