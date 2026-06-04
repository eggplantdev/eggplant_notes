'use client'

import { useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/features/account/actions/delete-account'
import { useActionTransition } from '@/hooks/use-action-transition'

const CONFIRM_WORD = 'DELETE'

// Type-to-confirm gate fronting the irreversible delete. The success path
// redirects server-side, so we only handle the failure branch here (keep the
// dialog open and surface the error inline).
export function DeleteAccountDialog() {
  const [confirmText, setConfirmText] = useState('')
  const { error, isPending, run } = useActionTransition()

  const isConfirmed = confirmText === CONFIRM_WORD

  function handleDelete() {
    // Terminal: success redirects + signs out, so no success toast here — the hook only ever
    // toasts the failure path (keeping the dialog open with the inline error).
    run(() => deleteAccount())
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account and all your notes, topic checks, and review
            history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="confirm-delete">
            Type <span className="font-medium">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <FormError message={error} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!isConfirmed || isPending}
            onClick={(event) => {
              // Keep the dialog open; the action drives navigation on success
              // and we render the error inline on failure.
              event.preventDefault()
              handleDelete()
            }}
          >
            {isPending ? 'Deleting…' : 'Delete account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
