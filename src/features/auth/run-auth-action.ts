import type { ZodType } from 'zod'

import { validateInput } from '@/lib/validate'
import { createClient } from '@/lib/supabase/create-server-client'
import type { ActionResultT } from '@/types/action'

type SupabaseServerT = Awaited<ReturnType<typeof createClient>>

// Not a Server Action itself — deliberately kept out of a `'use server'` file. Success
// redirects are left to callers since the redirect target varies per action.
export async function runAuthAction<T>(
  schema: ZodType<T>,
  input: unknown,
  call: (supabase: SupabaseServerT, data: T) => Promise<{ error: { message: string } | null }>,
  // Optional sanitizer for the auth-layer error only (validation errors are always user-safe).
  // Sign-up uses it to collapse "User already registered" into a neutral message (no enumeration).
  sanitizeAuthError?: (message: string) => string,
): Promise<ActionResultT> {
  const parsed = validateInput(schema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { error } = await call(supabase, parsed.data)
  if (error) {
    return {
      success: false,
      error: sanitizeAuthError ? sanitizeAuthError(error.message) : error.message,
    }
  }

  return { success: true }
}
