'use client'

import { useState, useTransition } from 'react'

import { toastMessage, toastSuccess } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Fires a Server Action inside a transition (pending/disabled state) and exposes the returned
// `{ success: false }` error as inline `error` state. `run` takes a thunk so the caller binds the
// args, and RETURNS the resolved result so callers owning optimistic state can revert on failure.
// Errors are NOT toasted by default — most callers render `error` inline, so a toast would just
// repeat the visible message. Bare-button callers with no inline surface pass `toastError: true`.
export function useActionTransition() {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function run<T extends ActionResultT>(
    action: () => Promise<T>,
    opts?: { successMessage?: string; toastError?: boolean },
  ): Promise<T> {
    setError(undefined)
    return new Promise<T>((resolve) => {
      startTransition(async () => {
        const result = await action()
        if (result.success) {
          if (opts?.successMessage) toastSuccess(opts.successMessage)
        } else {
          setError(result.error)
          if (opts?.toastError) toastMessage(result.error, 'error')
        }
        resolve(result)
      })
    })
  }

  // Clear a stale inline error without firing the action — e.g. when a dialog closes on Cancel/Esc so
  // a prior failure doesn't flash on reopen. `run` already resets on its own start.
  function reset() {
    setError(undefined)
  }

  return { error, isPending, reset, run }
}
