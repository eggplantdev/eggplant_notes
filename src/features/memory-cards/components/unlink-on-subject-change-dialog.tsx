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

type UnlinkOnSubjectChangeDialogPropsT = {
  noteTitle: string | null | undefined
  onConfirm: () => void
  onCancel: () => void
}

// Shown when a LINKED card's subject is changed on save: a linked card shares its note's subject, so
// changing it must unlink. Confirms before the write (the core re-derives the unlink server-side; this
// gate is purely the UX warning). Rendered only while a confirm is pending, so it's always `open`.
export function UnlinkOnSubjectChangeDialog({
  noteTitle,
  onConfirm,
  onCancel,
}: UnlinkOnSubjectChangeDialogPropsT) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink from note?</AlertDialogTitle>
          <AlertDialogDescription>
            Changing the subject will unlink this card from “{noteTitle ?? 'its note'}”. The card
            keeps the new subject and becomes standalone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction data-testid="card-unlink-confirm" onClick={onConfirm}>
            Unlink &amp; save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
