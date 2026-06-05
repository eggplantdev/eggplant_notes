'use client'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { deleteSubject } from '@/features/subjects/actions/delete-subject'
import { useActionTransition } from '@/hooks/use-action-transition'

// Controlled delete-confirmation dialog for a subject. `subjectId` non-null → open, confirming
// that subject; null → closed. Controlled so a single instance can serve a whole list (one
// dialog, not one Radix tree per row — see SubjectsList). Mirrors DeleteNoteDialog: a thin
// wrapper over the shared ConfirmDeleteDialog owning the deleteSubject transition. Member notes
// are DETACHED, not deleted (FK set null) — the copy says so explicitly. deleteSubject redirects
// to /subjects on success (so the action only ever returns on failure), surfacing the success
// toast via the post-redirect `?toast` flag; a returned failure shows inline + as a toast and
// keeps the dialog open.
type DeleteSubjectDialogPropsT = {
  subjectId: string | null
  onOpenChange: (open: boolean) => void
}

export function DeleteSubjectDialog({ subjectId, onOpenChange }: DeleteSubjectDialogPropsT) {
  const { error, isPending, run } = useActionTransition()

  return (
    <ConfirmDeleteDialog
      open={subjectId !== null}
      onOpenChange={onOpenChange}
      title="Delete this subject?"
      description="This deletes the subject only. Its notes are kept and become unassigned — nothing is lost. This can’t be undone."
      isPending={isPending}
      error={error}
      onConfirm={() => {
        if (subjectId) run(() => deleteSubject(subjectId))
      }}
    />
  )
}
