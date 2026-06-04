import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Called from a form's `onSubmit` with the action result: toasts the form-level error (the form
// still keeps its own inline <FormError> — both channels, by design) and, on success, an optional
// confirmation message. Returns `result.success` so the caller can branch (set inline error /
// reset / navigate). Field-level Zod errors are NOT routed here — they stay inline only, since
// they fire per keystroke/blur and a toast per keystroke would be noise.
// Type predicate (`result is { success: true }`) so callers keep discriminated-union narrowing:
// in `if (!toastActionResult(result)) { … result.error … }` the negated branch narrows `result`
// to the failure variant, exactly as a raw `if (!result.success)` check would.
export function toastActionResult(
  result: ActionResultT,
  opts?: { successMessage?: string },
): result is { success: true } {
  if (!result.success) {
    toastMessage(result.error, 'error')
    return false
  }
  if (opts?.successMessage) toastMessage(opts.successMessage, 'success')
  return true
}
