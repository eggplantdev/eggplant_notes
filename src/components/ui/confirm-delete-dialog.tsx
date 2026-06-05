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

// Shared, controlled destructive-confirm dialog. Domain-free chrome promoted out of the
// per-feature delete dialogs (notes, subjects, topic-checks, account) once they passed the
// 2nd-consumer threshold — see EX-380. Each feature keeps its thin wrapper that owns the
// useActionTransition + Server Action call and maps it onto `onConfirm`/`isPending`/`error`.
//
// Controlled: `open` + `onOpenChange`. Closing is suppressed while `isPending` so Radix can't
// dismiss before the transition resolves; the action's own `preventDefault` (here, on the
// confirm click) keeps it open across the await. The action button is disabled while pending
// AND while `confirmDisabled` (the account type-to-confirm gate). `children` renders extra body
// content (e.g. that type-to-confirm input) between the description and the footer; pass `error`
// for the inline FormError, or omit it and place your own inside `children`.
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
            variant="destructive"
            disabled={isPending || confirmDisabled}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {isPending ? 'Deleting…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
