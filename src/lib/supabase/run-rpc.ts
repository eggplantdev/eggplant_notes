import type { PostgrestError } from '@supabase/supabase-js'

// Normalizes a PostgREST `.rpc()` read to its data, throwing on error — the RPC analogue of
// runTableQuery. For read RPCs whose failure should surface to an error boundary. NOT for the
// action-result call sites (record_review, create_note_with_checks) that fold errors into a
// `{ success: false }` envelope instead of throwing.
export async function runRpc<T>(
  label: string,
  query: () => PromiseLike<{ data: T; error: PostgrestError | null }>,
): Promise<T> {
  const { data, error } = await query()
  if (error) {
    console.error(`[${label}] PostgREST error`, error)
    throw new Error(error.message, { cause: error })
  }
  return data
}
