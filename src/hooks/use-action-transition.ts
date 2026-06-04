'use client'

import { useState, useTransition } from 'react'

import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Shared client-island scaffold for firing a Server Action: run it inside a transition (for the
// pending/disabled state), surface a returned `{ success: false }` error inline AND as a toast,
// and optionally toast a success message. Promoted to src/hooks on the 2nd consumer (review
// rating buttons + topic-check delete) per the feature-first rule. `run` takes a thunk so the
// caller binds the action's arguments, and RETURNS the resolved result so callers that own
// optimistic state (reorder, subject-picker) can revert on failure — the transition still drives
// `isPending`. Callers without optimistic state ignore the return.
export function useActionTransition() {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function run(
    action: () => Promise<ActionResultT>,
    opts?: { successMessage?: string },
  ): Promise<ActionResultT> {
    setError(undefined)
    return new Promise<ActionResultT>((resolve) => {
      startTransition(async () => {
        const result = await action()
        if (!result.success) {
          setError(result.error)
          toastMessage(result.error, 'error')
        } else if (opts?.successMessage) {
          toastMessage(opts.successMessage, 'success')
        }
        resolve(result)
      })
    })
  }

  return { error, isPending, run }
}
