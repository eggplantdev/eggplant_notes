'use client'

import { useState } from 'react'

import { toastActionResult } from '@/components/forms/toast-result'
import type { ActionResultT } from '@/types/action'

// Owns the form-level error string + the toast-or-surface decision shared by every Server-Action form.
// `reportResult` toasts on success / surfaces the error inline on failure, and returns the success
// predicate so callers can branch further (navigate, reset, close). `clearError` runs before each
// submit so a stale error doesn't linger.
export function useFormError() {
  const [formError, setFormError] = useState<string | undefined>(undefined)

  function reportResult(
    result: ActionResultT,
    opts?: { successMessage?: string },
  ): result is { success: true } {
    if (!toastActionResult(result, opts)) setFormError(result.error)
    return result.success
  }

  function clearError() {
    setFormError(undefined)
  }

  return { formError, clearError, reportResult }
}
