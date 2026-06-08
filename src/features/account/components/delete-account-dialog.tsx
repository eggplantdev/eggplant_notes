'use client'

import { useState } from 'react'

import { DeleteButton } from '@/components/ui/delete-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/features/account/actions/delete-account'

const CONFIRM_WORD = 'DELETE'

// Type-to-confirm gate fronting the irreversible delete. Owns the confirm-word state and feeds the
// input through DeleteButton's extra-body slot, gating its confirm button via `confirmDisabled`.
// Success redirects + signs out server-side, so there's no client success path here.
export function DeleteAccountDialog() {
  const [confirmText, setConfirmText] = useState('')
  const isConfirmed = confirmText === CONFIRM_WORD

  return (
    <DeleteButton
      triggerLabel="Delete account"
      triggerSize="default"
      title="Delete your account?"
      description="This permanently deletes your account and all your notes, memory cards, and review history. This cannot be undone."
      confirmLabel="Delete account"
      confirmDisabled={!isConfirmed}
      action={() => deleteAccount()}
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
    </DeleteButton>
  )
}
