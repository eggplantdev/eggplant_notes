import type { SupabaseClient } from '@supabase/supabase-js'

import type { MemoryCardInputT } from '@/features/memory-cards/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared core: bulk-insert cards under an existing note, inheriting the note's subject. Reused by the
// createCardsForNote action (cookie client) and POST /api/memory-cards (minted-JWT client). RLS + the
// user_id default guard ownership. Throws the PostgrestError; callers shape the result.
export async function insertCardsForNote(
  supabase: SupabaseClient<Database>,
  noteId: string,
  cards: MemoryCardInputT[],
): Promise<string[]> {
  const { data: note } = await supabase.from('notes').select('subject_id').eq('id', noteId).single()
  const rows = cards.map((c) => ({ ...c, note_id: noteId, subject_id: note?.subject_id ?? null }))
  const { data, error } = await supabase.from('memory_cards').insert(rows).select('id')
  if (error) throw error
  return (data ?? []).map((r) => r.id)
}
