'use client'

import { useState } from 'react'

import { DeleteButton } from '@/components/ui/delete-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAccount } from '@/features/account/actions/delete-account'

const CONFIRM_WORD = 'DELETE'

// Two-gate guard fronting the irreversible delete: type-to-confirm (prevents an accidental click)
// plus the current password (step-up re-auth — the server re-verifies it so a hijacked session
// can't destroy the account). Both feed DeleteButton's extra-body slot and gate its confirm button
// via `confirmDisabled`. Success redirects + signs out server-side, so there's no client success path.
export function DeleteAccountDialog() {
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const isConfirmed = confirmText === CONFIRM_WORD && password.length > 0

  return (
    <DeleteButton
      triggerLabel="Delete account"
      triggerSize="sm"
      title="Delete your account?"
      description="This permanently deletes your account and all your notes, memory cards, and review history. This cannot be undone."
      confirmLabel="Delete account"
      confirmDisabled={!isConfirmed}
      action={() => deleteAccount({ password })}
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
      <div className="grid gap-2">
        <Label htmlFor="confirm-password">Current password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </div>
    </DeleteButton>
  )
}
