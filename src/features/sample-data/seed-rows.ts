import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { Database } from '@/lib/supabase/types'

const SEED_REVALIDATE_PATHS = ['/notes', '/subjects', '/dashboard', '/settings', '/review']

export function revalidateSeedPaths(): void {
  SEED_REVALIDATE_PATHS.forEach((path) => revalidatePath(path))
}

// Notes first (their memory_cards cascade via the note_id FK — and seeded review_events cascade from
// those cards), then subjects. Shared by Clear and the loader's rollback. Returns an error string
// instead of throwing so rollback needs no try/catch.
export async function deleteSeededRows(
  supabase: SupabaseClient<Database>,
): Promise<{ error?: string }> {
  const notes = await supabase.from('notes').delete().eq('is_seeded', true)
  if (notes.error) return { error: notes.error.message }

  const subjects = await supabase.from('subjects').delete().eq('is_seeded', true)
  if (subjects.error) return { error: subjects.error.message }

  return {}
}

// Full content wipe fronting the reload-on-a-non-empty-account path: removes ALL of the caller's
// subjects, notes, cards, and (via cascade) review history — NOT credentials, API tokens, or
// settings. memory_cards first so standalone (note_id null) cards go too; review_events cascade from
// memory_cards. Restores the empty-account invariant so the loader's is_seeded rollback stays safe.
// Same error-string contract as deleteSeededRows. RLS already scopes to the caller; the explicit
// user_id filter also satisfies PostgREST's delete-needs-a-filter guard.
export async function deleteAllUserContent(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ error?: string }> {
  const cards = await supabase.from('memory_cards').delete().eq('user_id', userId)
  if (cards.error) return { error: cards.error.message }

  const notes = await supabase.from('notes').delete().eq('user_id', userId)
  if (notes.error) return { error: notes.error.message }

  const subjects = await supabase.from('subjects').delete().eq('user_id', userId)
  if (subjects.error) return { error: subjects.error.message }

  return {}
}
