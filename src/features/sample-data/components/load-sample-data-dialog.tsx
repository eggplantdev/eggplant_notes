'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loadSampleData } from '@/features/sample-data/actions/load-sample-data'
import { useActionTransition } from '@/hooks/use-action-transition'

// Non-empty-account path: loading the sample set WIPES all existing content first, so it's fronted by
// the same step-up re-auth as account deletion — confirm with the current password (the server
// re-verifies it). No type-to-confirm word (unlike delete-account): this is recoverable, not terminal,
// so the password gate alone suffices. Closed explicitly on success — the trigger persists across
// revalidation (it isn't a list row that disappears), so nothing else would dismiss it.
export function LoadSampleDataDialog() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const { error, isPending, run } = useActionTransition()

  function handleConfirm() {
    run(() => loadSampleData({ password }), { successMessage: 'Sample data loaded' }).then(
      (result) => {
        if (result.success) {
          setOpen(false)
          setPassword('')
        }
      },
    )
  }

  return (
    <>
      <Button variant="glowy-red" data-testid="sample-data-load" onClick={() => setOpen(true)}>
        Load sample data
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title="Replace your data with sample data?"
        description="This permanently deletes all your current subjects, notes, memory cards, and review history, then loads the sample set. This cannot be undone."
        isPending={isPending}
        error={error}
        confirmLabel="Wipe and load"
        pendingLabel="Loading…"
        confirmDisabled={password.length === 0}
        onConfirm={handleConfirm}
      >
        <div className="grid gap-2">
          <Label htmlFor="confirm-load-password">Current password</Label>
          <Input
            id="confirm-load-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
      </ConfirmDeleteDialog>
    </>
  )
}
