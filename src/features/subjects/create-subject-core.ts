import type { SupabaseClient } from '@supabase/supabase-js'

import type { SubjectInputT } from '@/features/subjects/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared insert core for a subject, reused by the createSubject Server Action (cookie client) and the
// POST /api/subjects route (minted-JWT client) — mirrors insertNoteWithChecks. `user_id` is never sent:
// the DB defaults it to auth.uid() and RLS `with check` owns ownership regardless of caller. Errors are
// returned as values (logged here, never thrown) so all four *-core modules share one error contract.
export async function createSubjectCore(
  supabase: SupabaseClient<Database>,
  data: SubjectInputT,
): Promise<{ id: string } | { error: string }> {
  const { data: row, error } = await supabase.from('subjects').insert(data).select('id').single()
  if (error) {
    console.error('[createSubjectCore] PostgREST error', error)
    return { error: error.message }
  }
  return row
}
