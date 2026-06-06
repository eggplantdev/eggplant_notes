import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

// Normalizes a PostgREST `{ data, error }` read to typed rows. Reads throw (rather than return
// ActionResultT) so an unexpected DB/RLS failure surfaces to the caller's error boundary.
export async function runTableQuery<T>(
  client: SupabaseClient<Database>,
  query: (
    client: SupabaseClient<Database>,
  ) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await query(client)
  // Keep the original PostgrestError on `cause` so a caller can branch on code/details/hint
  // (e.g. RLS denial vs. constraint).
  if (error) {
    console.error('[runTableQuery] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  if (data === null) throw new Error('Supabase query returned no data')
  return data
}
