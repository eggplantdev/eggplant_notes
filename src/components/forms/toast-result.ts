import { toastResult } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Toasts only form-level errors; field-level Zod errors stay inline (a toast per keystroke would be noise).
// Returns `result.success` as a type predicate so callers keep discriminated-union narrowing in `if (!...)`.
export function toastActionResult(
  result: ActionResultT,
  opts?: { successMessage?: string },
): result is { success: true } {
  toastResult(result, opts?.successMessage)
  return result.success
}
