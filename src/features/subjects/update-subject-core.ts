import type { SupabaseClient } from '@supabase/supabase-js'

import type { SubjectInputT } from '@/features/subjects/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared update core for a subject, reused by updateSubject (cookie client) and PATCH /api/subjects/:id
// (minted-JWT client). RLS scopes the update to the owner: a non-owned/nonexistent id matches zero rows,
// so `.maybeSingle()` resolves to undefined (the caller maps that to a not-found / 404) rather than
// throwing. A real PostgREST error still throws; callers shape the result.
export async function updateSubjectCore(
  supabase: SupabaseClient<Database>,
  id: string,
  data: SubjectInputT,
): Promise<{ id: string } | undefined> {
  const { data: row, error } = await supabase
    .from('subjects')
    .update(data)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return row ?? undefined
}
