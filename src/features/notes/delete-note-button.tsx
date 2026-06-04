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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { deleteNote } from '@/features/notes/actions/delete-note'
import { useActionTransition } from '@/hooks/use-action-transition'

type DeleteNoteButtonPropsT = { id: string }

// Destructive control on the detail page (FR-010). Confirms via AlertDialog, then fires
// the deleteNote Server Action inside a transition. On success the action redirects to
// /notes (so the callback never returns); a returned failure is surfaced inline and the
// dialog stays open. `preventDefault` on the action stops Radix from auto-closing the
// dialog before the transition resolves. The note's topic checks cascade at the DB.
export function DeleteNoteButton({ id }: DeleteNoteButtonPropsT) {
  const { error, isPending, run } = useActionTransition()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
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
              // deleteNote redirects on success, so it only ever returns on failure — the hook
              // toasts that error inline + as a toast. Success confirms via the Phase-4 ?toast flag
              // after the redirect lands (no successMessage here).
              run(() => deleteNote(id))
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
