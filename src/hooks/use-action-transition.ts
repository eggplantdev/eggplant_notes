'use client'

import { useState, useTransition } from 'react'

import { toastResult } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Shared client-island scaffold for firing a Server Action: run it inside a transition (for the
// pending/disabled state), surface a returned `{ success: false }` error inline AND as a toast,
// and optionally toast a success message. Promoted to src/hooks on the 2nd consumer (review
// rating buttons + memory-card delete) per the feature-first rule. `run` takes a thunk so the
// caller binds the action's arguments, and RETURNS the resolved result so callers that own
// optimistic state (reorder, subject-picker) can revert on failure — the transition still drives
// `isPending`. Callers without optimistic state ignore the return.
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
