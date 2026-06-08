'use client'

import type { ReactNode } from 'react'

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
import { FormError } from '@/components/forms/form-components/form-error'

// Shared controlled destructive-confirm dialog. Closing is suppressed while `isPending` so Radix can't
// dismiss before the transition resolves. The confirm button is disabled while pending and while
// `confirmDisabled` (e.g. the account type-to-confirm gate); `children` renders extra body content between description and footer.
type ConfirmDeleteDialogPropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  onConfirm: () => void
  isPending: boolean
  error?: string
  confirmDisabled?: boolean
  confirmLabel?: string
  // Label shown on the confirm button while the action runs — defaults to the delete wording, but a
  // non-delete reuse (e.g. resetting a prompt) can pass its own.
  pendingLabel?: string
  children?: ReactNode
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
  error,
  confirmDisabled = false,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  children,
}: ConfirmDeleteDialogPropsT) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error !== undefined && <FormError message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="glowy-red"
            disabled={isPending || confirmDisabled}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
