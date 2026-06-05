'use client'

import { useState } from 'react'

import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/features/account/actions/delete-account'
import { useActionTransition } from '@/hooks/use-action-transition'

const CONFIRM_WORD = 'DELETE'

// Type-to-confirm gate fronting the irreversible delete. Owns its own trigger Button + open
// state and feeds the type-to-confirm input through the shared ConfirmDeleteDialog's `children`
// slot, gating its confirm button via `confirmDisabled`. The success path redirects server-side,
// so we only handle the failure branch here (the shared dialog keeps itself open while pending
// and surfaces the inline error).
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const { error, isPending, run } = useActionTransition()

  const isConfirmed = confirmText === CONFIRM_WORD

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This permanently deletes your account and all your notes, topic checks, and review history. This cannot be undone."
        isPending={isPending}
        error={error}
        confirmDisabled={!isConfirmed}
        confirmLabel="Delete account"
        // Terminal: success redirects + signs out, so no success toast here — the hook only ever
        // toasts the failure path (keeping the dialog open with the inline error).
        onConfirm={() => run(() => deleteAccount())}
      >
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
        </div>
      </ConfirmDeleteDialog>
    </>
  )
}
