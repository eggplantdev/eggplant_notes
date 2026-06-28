'use client'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { deleteSubject } from '@/features/subjects/actions/delete-subject'
import { useActionTransition } from '@/hooks/use-action-transition'
import { useActionNavigation } from '@/hooks/use-action-navigation'

// Controlled (`subjectId` non-null → open) so a single instance can serve a whole list, not one
// Radix tree per row. On success the dialog client-navigates to /subjects; a failure keeps the dialog
// open + shows the error. Member notes are detached, not deleted.
type DeleteSubjectDialogPropsT = {
  subjectId: string | null
  onOpenChange: (open: boolean) => void
}

export function DeleteSubjectDialog({ subjectId, onOpenChange }: DeleteSubjectDialogPropsT) {
  const { error, isPending, run } = useActionTransition()
  const { isNavigating, navigate } = useActionNavigation()

  return (
    <ConfirmDeleteDialog
      open={subjectId !== null}
      onOpenChange={onOpenChange}
      title="Delete this subject?"
      description="This deletes the subject only. Its notes are kept and become unassigned — nothing is lost. This can’t be undone."
      isPending={isPending || isNavigating}
      error={error}
      onConfirm={() => {
        if (!subjectId) return
        run(() => deleteSubject(subjectId)).then((result) => {
          if (result.success) navigate('/subjects', 'subject-deleted')
        })
      }}
    />
  )
}
