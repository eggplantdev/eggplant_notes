import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/supabase/types'

// Every page whose content derives from seeded rows; load and clear both revalidate the whole set.
const SEED_REVALIDATE_PATHS = ['/notes', '/subjects', '/dashboard', '/settings', '/review']

export function revalidateSeedPaths(): void {
  SEED_REVALIDATE_PATHS.forEach((path) => revalidatePath(path))
}

// Notes first (their memory_cards cascade via the note_id FK), then subjects. Shared by Clear and
// the loader's rollback. Returns an error string instead of throwing so rollback needs no try/catch.
export async function deleteSeededRows(
  supabase: SupabaseClient<Database>,
): Promise<{ error?: string }> {
  const notes = await supabase.from('notes').delete().eq('is_seeded', true)
  if (notes.error) return { error: notes.error.message }

  const subjects = await supabase.from('subjects').delete().eq('is_seeded', true)
  if (subjects.error) return { error: subjects.error.message }

  return {}
}
