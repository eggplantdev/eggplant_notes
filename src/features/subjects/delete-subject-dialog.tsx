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
import { deleteSubject } from '@/features/subjects/actions/delete-subject'
import { useActionTransition } from '@/hooks/use-action-transition'

// Controlled delete-confirmation dialog for a subject. `subjectId` non-null → open, confirming
// that subject; null → closed. Controlled so a single instance can serve a whole list (one
// dialog, not one Radix tree per row — see SubjectsList). Mirrors DeleteNoteDialog. Member
// notes are DETACHED, not deleted (FK set null) — the copy says so explicitly. deleteSubject
// redirects to /subjects on success (so the action only ever returns on failure), surfacing the
// success toast via the post-redirect `?toast` flag; a returned failure shows inline + as a
// toast and keeps the dialog open. `preventDefault` on the action stops Radix auto-closing
// before the transition resolves.
type DeleteSubjectDialogPropsT = {
  subjectId: string | null
  onOpenChange: (open: boolean) => void
}

export function DeleteSubjectDialog({ subjectId, onOpenChange }: DeleteSubjectDialogPropsT) {
  const { error, isPending, run } = useActionTransition()

  return (
    <AlertDialog
      open={subjectId !== null}
      onOpenChange={(open) => {
        if (!isPending) onOpenChange(open)
      }}
    >
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
              if (subjectId) run(() => deleteSubject(subjectId))
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
