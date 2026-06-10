import type { SupabaseClient } from '@supabase/supabase-js'

import type { SubjectInputT } from '@/features/subjects/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared update core for a subject, reused by updateSubject (cookie client) and PATCH /api/subjects/:id
// (minted-JWT client). RLS scopes the update to the owner: a non-owned/nonexistent id matches zero rows
// → `{ error, notFound: true }`. Errors are returned as values (logged here, never thrown) so all four
// *-core modules share one error contract; `notFound` lets the route 404 without leaking existence.
export async function updateSubjectCore(
  supabase: SupabaseClient<Database>,
  id: string,
  data: SubjectInputT,
): Promise<{ id: string } | { error: string; notFound?: boolean }> {
  const { data: row, error } = await supabase
    .from('subjects')
    .update(data)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[updateSubjectCore] PostgREST error', error)
    return { error: error.message }
  }
  if (!row) return { error: 'Subject not found', notFound: true }
  return row
}
