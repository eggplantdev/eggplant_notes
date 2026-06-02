// Field errors may be plain strings (function validators) or standard-schema
// issue objects (Zod validators). Normalize both to a joined message string.
function toMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return undefined
}

export function getFieldErrorText(errors: readonly unknown[]): string {
  return errors.map(toMessage).filter(Boolean).join(', ')
}
