'use client'

import { useState, useTransition } from 'react'

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
import { FormError } from '@/components/forms/form-components/form-error'
import { deleteNote } from '@/features/notes/actions/delete-note'

type DeleteNoteButtonPropsT = { id: string }

// Destructive control on the detail page (FR-010). Confirms via AlertDialog, then fires
// the deleteNote Server Action inside a transition. On success the action redirects to
// /notes (so the callback never returns); a returned failure is surfaced inline and the
// dialog stays open. `preventDefault` on the action stops Radix from auto-closing the
// dialog before the transition resolves. The note's topic checks cascade at the DB.
export function DeleteNoteButton({ id }: DeleteNoteButtonPropsT) {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

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
              setError(undefined)
              startTransition(async () => {
                const result = await deleteNote(id)
                if (result && !result.success) setError(result.error)
              })
            }}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
