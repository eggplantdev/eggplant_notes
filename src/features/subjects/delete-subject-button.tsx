'use client'

import { FormError } from '@/components/forms/form-components/form-error'
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
import { Button } from '@/components/ui/button'
import { deleteSubject } from '@/features/subjects/actions/delete-subject'
import { useActionTransition } from '@/hooks/use-action-transition'

type DeleteSubjectButtonPropsT = { id: string }

// Destructive control on the subject page. Member notes are DETACHED, not deleted (FK set
// null) — the copy says so explicitly. Mirrors DeleteNoteButton: confirm via AlertDialog,
// fire the action in a transition, `preventDefault` so Radix doesn't close before it
// resolves. On success the action redirects to /subjects; a failure surfaces inline.
export function DeleteSubjectButton({ id }: DeleteSubjectButtonPropsT) {
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
          <AlertDialogTitle>Delete this subject?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the subject only. Its notes are kept and become unassigned — nothing is
            lost. This can&apos;t be undone.
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
              // Redirects to /subjects on success → returns only on failure (hook toasts it).
              // Success confirms via the Phase-4 ?toast flag after the redirect.
              run(() => deleteSubject(id))
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
