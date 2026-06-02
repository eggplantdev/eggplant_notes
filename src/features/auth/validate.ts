import type { ZodType } from 'zod'

// Safe-parse `data` against a Zod schema, flattening to the first error message.
export function validateInput<T>(
  schema: ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const parsed = schema.safeParse(data)
  if (parsed.success) return { success: true, data: parsed.data }
  return {
    success: false,
    error: parsed.error.issues[0]?.message ?? 'Invalid input',
  }
}
