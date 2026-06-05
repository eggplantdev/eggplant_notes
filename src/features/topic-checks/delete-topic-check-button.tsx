'use client'

import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { deleteTopicCheck } from '@/features/topic-checks/actions/delete-topic-check'
import { useActionTransition } from '@/hooks/use-action-transition'

type DeleteTopicCheckButtonPropsT = { noteId: string; id: string }

// Destructive control per row (FR-014). Owns its own trigger Button + open state (the shared
// ConfirmDeleteDialog is controlled-only, no built-in trigger), then fires the deleteTopicCheck
// Server Action inside a transition. The action revalidates the note's detail path, so on success
// the row disappears and the dialog unmounts with it; a returned failure is surfaced inline and
// the dialog stays open (the shared dialog suppresses close while pending). The check's
// review_events cascade at the DB.
export function DeleteTopicCheckButton({ noteId, id }: DeleteTopicCheckButtonPropsT) {
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
        title="Delete this topic check?"
        description="This permanently deletes the topic check and its review history. This can’t be undone."
        isPending={isPending}
        error={error}
        onConfirm={() =>
          run(() => deleteTopicCheck(noteId, id), { successMessage: 'Check deleted' })
        }
      />
    </>
  )
}
