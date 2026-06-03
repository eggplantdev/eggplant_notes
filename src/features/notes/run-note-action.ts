import type { PostgrestSingleResponse } from '@supabase/supabase-js'
import type { ZodType } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'

type SupabaseServerT = Awaited<ReturnType<typeof createClient>>

export type NoteActionResultT<T> = { success: true; data: T } | { success: false; error: string }

// Table analogue of runAuthAction for note mutations: validate input, create the server
// client, run the PostgREST write, and normalize the `{ data, error }` envelope to a
// discriminated result. Unlike runTableQuery (which THROWS so reads surface to an error
// boundary), mutations are form-driven — a *returned* error lets the form render it
// inline, mirroring runAuthAction. Writes end in `.select().single()` (→
// PostgrestSingleResponse) so a successful call returns the affected row, which
// create/update use for the post-write redirect. Not a Server Action itself — kept out
// of a `'use server'` file deliberately.
export async function runNoteAction<TInput, TRow>(
  schema: ZodType<TInput>,
  input: unknown,
  call: (supabase: SupabaseServerT, data: TInput) => PromiseLike<PostgrestSingleResponse<TRow>>,
): Promise<NoteActionResultT<TRow>> {
  const parsed = validateInput(schema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const { data, error } = await call(supabase, parsed.data)
  if (error) {
    console.error('[runNoteAction] PostgREST error', error)
    return { success: false, error: error.message }
  }
  return { success: true, data }
}
