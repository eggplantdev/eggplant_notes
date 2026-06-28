'use client'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { deleteNote } from '@/features/notes/actions/delete-note'
import { useActionTransition } from '@/hooks/use-action-transition'
import { useActionNavigation } from '@/hooks/use-action-navigation'

// Controlled (`noteId` non-null → open) so a single instance can serve a whole list, not one
// Radix tree per row. On success the dialog client-navigates to `redirectTo`; a failure keeps the
// dialog open + shows the error.
type DeleteNoteDialogPropsT = {
  noteId: string | null
  onOpenChange: (open: boolean) => void
  // Post-delete destination (client-known) — the subject view passes /subjects/[id] so the docs
  // context survives the delete; defaults to the notes list.
  redirectTo?: string
}

export function DeleteNoteDialog({
  noteId,
  onOpenChange,
  redirectTo = '/notes',
}: DeleteNoteDialogPropsT) {
  const { error, isPending, run } = useActionTransition()
  const { isNavigating, navigate } = useActionNavigation()

  return (
    <ConfirmDeleteDialog
      open={noteId !== null}
      onOpenChange={onOpenChange}
      title="Delete this note?"
      description="This permanently deletes the note and its memory cards. This can’t be undone."
      isPending={isPending || isNavigating}
      error={error}
      onConfirm={() => {
        if (!noteId) return
        run(() => deleteNote(noteId)).then((result) => {
          if (result.success) navigate(redirectTo, 'note-deleted')
        })
      }}
    />
  )
}
