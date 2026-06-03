import type { ZodType } from 'zod'

import { validateInput } from '@/lib/validate'
import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

type SupabaseServerT = Awaited<ReturnType<typeof createClient>>

// Shared skeleton for auth Server Actions: validate input, create the server client,
// run the Supabase call, normalize its `{ error }` to an ActionResultT. Callers that
// redirect on success do so themselves (the redirect target varies per action).
// Not a Server Action itself — kept out of a `'use server'` file deliberately.
export async function runAuthAction<T>(
  schema: ZodType<T>,
  input: unknown,
  call: (supabase: SupabaseServerT, data: T) => Promise<{ error: { message: string } | null }>,
): Promise<ActionResultT> {
  const parsed = validateInput(schema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { error } = await call(supabase, parsed.data)
  if (error) return { success: false, error: error.message }

  return { success: true }
}
