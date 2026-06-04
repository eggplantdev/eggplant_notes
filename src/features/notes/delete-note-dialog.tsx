'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FormError } from '@/components/forms/form-components/form-error'
import { deleteNote } from '@/features/notes/actions/delete-note'
import { useActionTransition } from '@/hooks/use-action-transition'

// Controlled delete-confirmation dialog (FR-010). `noteId` non-null → open, confirming that
// note; null → closed. Controlled so a single instance can serve a whole list (one dialog, not
// one Radix tree per row — see NotesList). deleteNote redirects on success (so the action only
// ever returns on failure), surfacing the success toast via the post-redirect `?toast` flag; a
// returned failure shows inline + as a toast and keeps the dialog open. `preventDefault` on the
// action stops Radix auto-closing before the transition resolves. The note's topic checks
// cascade at the DB.
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
    <AlertDialog
      open={noteId !== null}
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the note and its topic checks. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormError message={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault()
              if (noteId) run(() => deleteNote(noteId, redirectTo))
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
