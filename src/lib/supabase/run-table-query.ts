import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

// Table analogue of runAuthAction: centralizes the PostgREST `{ data, error }` →
// typed-rows normalization. Takes an INJECTABLE typed client (defaulted to the
// per-request server client by the feature read helpers) plus a query thunk, awaits
// it, and returns typed rows or throws a normalized error. Reads return rows directly
// rather than going through ActionResultT; a thrown error surfaces unexpected DB/RLS
// failures to the caller's error boundary. Reusable for mutations when slices add them.
export async function runTableQuery<T>(
  client: SupabaseClient<Database>,
  query: (
    client: SupabaseClient<Database>,
  ) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await query(client)
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('Supabase query returned no data')
  return data
}
