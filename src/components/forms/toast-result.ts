import { toastResult } from '@/components/toasts'
import type { ActionResultT } from '@/types/action'

// Called from a form's `onSubmit` with the action result: toasts the form-level error (the form
// still keeps its own inline <FormError> — both channels, by design) and, on success, an optional
// confirmation message — delegating the toast branching to the shared `toastResult` so it stays in
// sync with the imperative seam (useActionTransition). Field-level Zod errors are NOT routed here;
// they stay inline only (a toast per keystroke/blur would be noise).
//
// Returns `result.success` as a TYPE PREDICATE so callers keep discriminated-union narrowing: in
// `if (!toastActionResult(result)) { … result.error … }` the negated branch narrows `result` to
// the failure variant, exactly as a raw `if (!result.success)` check would.
export function toastActionResult(
  result: ActionResultT,
  opts?: { successMessage?: string },
): result is { success: true } {
  toastResult(result, opts?.successMessage)
  return result.success
}
