import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import type { ZodType } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'

type SupabaseServerT = Awaited<ReturnType<typeof createClient>>

export type TableActionResultT<T> = { success: true; data: T } | { success: false; error: string }

// Validates input, runs a PostgREST write, and normalizes `{ data, error }` to a discriminated
// result. Unlike runTableQuery (which throws), mutations are form-driven — a *returned* error lets
// the form render it inline. Writes end in `.select().single()` so success returns the affected row
// for the post-write redirect/refresh. Deliberately kept out of a `'use server'` file.
export async function runTableAction<TInput, TRow>(
  schema: ZodType<TInput>,
  input: unknown,
  call: (supabase: SupabaseServerT, data: TInput) => PromiseLike<PostgrestSingleResponse<TRow>>,
): Promise<TableActionResultT<TRow>> {
  const parsed = validateInput(schema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { data, error } = await call(supabase, parsed.data)
  if (error) {
    // Log the real PostgREST error server-side; return a generic message so DB internals
    // (constraint/column/table names) never leak to the client.
    console.error('[runTableAction] PostgREST error', error)
    return { success: false, error: 'Something went wrong. Please try again.' }
  }
  return { success: true, data }
}
