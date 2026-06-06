'use client'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { deleteNote } from '@/features/notes/actions/delete-note'
import { useActionTransition } from '@/hooks/use-action-transition'

// Controlled (`noteId` non-null → open) so a single instance can serve a whole list, not one
// Radix tree per row. deleteNote redirects on success, so the action only ever returns on failure
// (which keeps the dialog open + shows the error).
type DeleteNoteDialogPropsT = {
  noteId: string | null
  onOpenChange: (open: boolean) => void
  // Where deleteNote redirects on success — the subject view passes /subjects/[id] so the docs
  // context survives the delete.
  redirectTo?: string
}

export function DeleteNoteDialog({ noteId, onOpenChange, redirectTo }: DeleteNoteDialogPropsT) {
  const { error, isPending, run } = useActionTransition()

  return (
    <ConfirmDeleteDialog
      open={noteId !== null}
      onOpenChange={onOpenChange}
      title="Delete this note?"
      description="This permanently deletes the note and its memory cards. This can’t be undone."
      isPending={isPending}
      error={error}
      onConfirm={() => {
        if (noteId) run(() => deleteNote(noteId, redirectTo))
      }}
    />
  )
}
