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
import { FormError } from '@/components/forms/form-components/form-error'
import { Button } from '@/components/ui/button'
import { deleteTopicCheck } from '@/features/topic-checks/actions/delete-topic-check'

type DeleteTopicCheckButtonPropsT = { noteId: string; id: string }

// Destructive control per row (FR-014). Confirms via AlertDialog, then fires the
// deleteTopicCheck Server Action inside a transition. The action revalidates the note's
// detail path, so on success the row disappears and the dialog unmounts with it; a returned
// failure is surfaced inline and the dialog stays open (`preventDefault` keeps Radix from
// auto-closing before the transition resolves). The check's review_events cascade at the DB.
export function DeleteTopicCheckButton({ noteId, id }: DeleteTopicCheckButtonPropsT) {
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
          <AlertDialogTitle>Delete this topic check?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the topic check and its review history. This can&apos;t be
            undone.
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
                const result = await deleteTopicCheck(noteId, id)
                if (!result.success) setError(result.error)
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
