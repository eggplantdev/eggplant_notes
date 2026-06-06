import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/supabase/types'

// Pages whose content derives from seeded rows; both load and clear revalidate the whole set so
// /notes, /subjects, the dashboard due-count and /review reflect the change on the next view.
const SEED_REVALIDATE_PATHS = ['/notes', '/subjects', '/dashboard', '/settings', '/review']

export function revalidateSeedPaths(): void {
  SEED_REVALIDATE_PATHS.forEach((path) => revalidatePath(path))
}

// Delete the caller's seeded rows: notes first (their memory_cards cascade via the note_id FK),
// then subjects. Shared by clearSampleData AND the loader's rollback path, so a failed partial
// load and an explicit Clear go through the exact same deletion. RLS scopes deletes to the owner;
// the `is_seeded` filter scopes to seeded rows only. Returns an error string instead of throwing
// so the loader's rollback can run without a try/catch.
export async function deleteSeededRows(
  supabase: SupabaseClient<Database>,
): Promise<{ error?: string }> {
  const notes = await supabase.from('notes').delete().eq('is_seeded', true)
  if (notes.error) return { error: notes.error.message }

  const subjects = await supabase.from('subjects').delete().eq('is_seeded', true)
  if (subjects.error) return { error: subjects.error.message }

  return {}
}
