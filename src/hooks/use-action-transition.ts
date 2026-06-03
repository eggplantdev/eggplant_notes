'use client'

import { useState, useTransition } from 'react'

import type { ActionResultT } from '@/types/action'

// Shared client-island scaffold for firing a Server Action: run it inside a transition (for the
// pending/disabled state) and surface a returned `{ success: false }` error inline. Promoted to
// src/hooks on the 2nd consumer (review rating buttons + topic-check delete) per the
// feature-first rule. `run` takes a thunk so the caller binds the action's arguments.
export function useActionTransition() {
  const [error, setError] = useState<string | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<ActionResultT>) {
    setError(undefined)
    startTransition(async () => {
      const result = await action()
      if (!result.success) setError(result.error)
    })
  }

  return { error, isPending, run }
}
