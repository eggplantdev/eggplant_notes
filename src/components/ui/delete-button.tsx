'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { useActionTransition } from '@/hooks/use-action-transition'
import type { ActionResultT } from '@/types/action'

// Self-contained destructive trigger: owns the open state + the action transition, and renders the
// shared ConfirmDeleteDialog. For single-target deletes; the list-served case keeps the controlled
// ConfirmDeleteDialog (one instance per list, driven by a pending id). `action` is a pre-bound thunk
// so callers close over their own ids. Success usually redirects (server-side) or revalidates the
// row away, so there's no explicit close — pass `onSuccess` only for client-side follow-ups (e.g.
// navigating off a now-deleted detail page). `children` feeds the dialog's extra-body slot.
type DeleteButtonPropsT = {
  title: string
  description: ReactNode
  action: () => Promise<ActionResultT>
  triggerLabel?: string
  triggerSize?: ComponentProps<typeof Button>['size']
  successMessage?: string
  onSuccess?: () => void
  confirmLabel?: string
  confirmDisabled?: boolean
  children?: ReactNode
}

export function DeleteButton({
  title,
  description,
  action,
  triggerLabel = 'Delete',
  triggerSize = 'sm',
  successMessage,
  onSuccess,
  confirmLabel,
  confirmDisabled,
  children,
}: DeleteButtonPropsT) {
  const [open, setOpen] = useState(false)
  const { error, isPending, run } = useActionTransition()

  return (
    <>
      <Button variant="glowy-red" size={triggerSize} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        isPending={isPending}
        error={error}
        confirmLabel={confirmLabel}
        confirmDisabled={confirmDisabled}
        onConfirm={() =>
          run(action, successMessage ? { successMessage } : undefined).then((result) => {
            if (result.success) onSuccess?.()
          })
        }
      >
        {children}
      </ConfirmDeleteDialog>
    </>
  )
}
