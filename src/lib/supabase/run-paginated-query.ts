import type { PostgrestError } from '@supabase/supabase-js'

type CountedResult<T> = { data: T[] | null; count: number | null; error: PostgrestError | null }
type CountResult = { count: number | null; error: PostgrestError | null }

// Runs a list read as `{ rows, total }` off one round-trip.
// Out-of-range handling: when the requested page starts past the last row (a manual ?page=99),
// PostgREST returns 416/PGRST103 and supabase-js drops the count (it doesn't parse Content-Range
// on the error path — verified empirically). So we fall back to a cheap head-count only on the 416
// and return an empty page with the real total, so the footer renders instead of a 500.
export async function runPaginatedQuery<T>(
  label: string,
  ranged: PromiseLike<CountedResult<T>>,
  countOnly: () => PromiseLike<CountResult>,
): Promise<{ rows: T[]; total: number }> {
  const { data, count, error } = await ranged
  if (!error) return { rows: data ?? [], total: count ?? 0 }
  if (error.code === 'PGRST103') {
    const { count: total } = await countOnly()
    return { rows: [], total: total ?? 0 }
  }
  console.error(`[${label}] PostgREST error`, error)
  throw new Error(error.message, { cause: error })
}
