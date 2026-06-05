'use client'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { deleteNote } from '@/features/notes/actions/delete-note'
import { useActionTransition } from '@/hooks/use-action-transition'

// Controlled delete-confirmation dialog (FR-010). `noteId` non-null → open, confirming that
// note; null → closed. Controlled so a single instance can serve a whole list (one dialog, not
// one Radix tree per row — see NotesList). Thin wrapper over the shared ConfirmDeleteDialog: it
// owns the deleteNote transition and maps it onto onConfirm/isPending/error; the dialog chrome
// (pending-close suppression, preventDefault on confirm) lives there. deleteNote redirects on
// success (so the action only ever returns on failure), surfacing the success toast via the
// post-redirect `?toast` flag; a returned failure shows inline + as a toast and keeps the dialog
// open. The note's memory cards cascade at the DB.
type DeleteNoteDialogPropsT = {
  noteId: string | null
  onOpenChange: (open: boolean) => void
  // Where deleteNote redirects on success (default /notes). The S-15 subject view passes its
  // /subjects/[id] so the docs context survives the delete.
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
