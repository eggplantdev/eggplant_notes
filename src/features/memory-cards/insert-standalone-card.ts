import type { SupabaseClient } from '@supabase/supabase-js'

import type { CardWithSubjectInputT } from '@/features/memory-cards/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared core: insert a standalone card (no note) under a subject. Reused by the createStandaloneCard
// action (cookie client) and POST /api/memory-cards (minted-JWT client). user_id defaults to auth.uid();
// RLS guards both ownership and that the chosen subject is the caller's. Throws; callers shape the result.
export async function insertStandaloneCard(
  supabase: SupabaseClient<Database>,
  data: CardWithSubjectInputT,
): Promise<string> {
  const { data: row, error } = await supabase
    .from('memory_cards')
    .insert({ ...data, note_id: null })
    .select('id')
    .single()
  if (error) throw error
  return row.id
}
