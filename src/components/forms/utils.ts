// Field errors may be plain strings (function validators) or standard-schema
// issue objects (Zod validators). Normalize both to a joined message string.
function toMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return undefined
}

// Dedupe: a field that wires the SAME schema to both `onBlur` and `onSubmit` (the intentional
// pattern — live-validate touched fields, still catch never-blurred ones at submit) accumulates one
// identical issue per validator, so without this the message renders twice ("X, X").
export function getFieldErrorText(errors: readonly unknown[]): string {
  const messages = errors.map(toMessage).filter(Boolean) as string[]
  return [...new Set(messages)].join(', ')
}
