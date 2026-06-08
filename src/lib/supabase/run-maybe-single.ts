import type { PostgrestError } from '@supabase/supabase-js'

// The `maybeSingle()` sibling of runTableQuery: fetch one row by id where a no-match is expected and
// must resolve to `undefined` (the caller decides 404), not throw. A *real* PostgREST/RLS error
// still throws to the caller's error boundary. Pass the already-built `.maybeSingle()` query; like
// the paginated runner, the builder is a lazy thenable that fires when awaited here.
export async function runMaybeSingle<T>(
  label: string,
  query: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<T | undefined> {
  const { data, error } = await query
  if (error) {
    console.error(`[${label}] PostgREST error`, error)
    throw new Error(error.message, { cause: error })
  }
  return data ?? undefined
}
