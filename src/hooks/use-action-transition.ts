'use client'

import { useState, useTransition } from 'react'

import { toastResult } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Fires a Server Action inside a transition (pending/disabled state) and surfaces a returned
// `{ success: false }` error inline AND as a toast. `run` takes a thunk so the caller binds the
// args, and RETURNS the resolved result so callers owning optimistic state can revert on failure.
export function useActionTransition() {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function run<T extends ActionResultT>(
    action: () => Promise<T>,
    opts?: { successMessage?: string },
  ): Promise<T> {
    setError(undefined)
    return new Promise<T>((resolve) => {
      startTransition(async () => {
        const result = await action()
        if (!result.success) setError(result.error)
        toastResult(result, opts?.successMessage)
        resolve(result)
      })
    })
  }

  return { error, isPending, run }
}
