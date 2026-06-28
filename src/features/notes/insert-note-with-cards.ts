import type { SupabaseClient } from '@supabase/supabase-js'

import type { CreateNoteWithCardsT } from '@/features/notes/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared write core for "note + its cards", reused by the createNote Server Action (cookie client) and
// the POST /api/notes route (minted-JWT client). `user_id` is never sent — the RPC reads jsonb fields
// explicitly and the DB defaults it to auth.uid(), so RLS owns ownership regardless of caller. A body
// `user_id` is therefore ignored at the DB. position = Date.now() appends to the subject's end without
// a max() read; an unassigned note gets null. Throws the PostgrestError; callers shape the result.
export async function insertNoteWithCards(
  supabase: SupabaseClient<Database>,
  { note, cards }: CreateNoteWithCardsT,
): Promise<string> {
  const hasSubject = Boolean(note.subject_id || note.subject_title)
  const { data: newId, error } = await supabase.rpc('create_note_with_cards', {
    p_note: { ...note, position: hasSubject ? Date.now() : null },
    p_cards: cards,
  })
  if (error) throw error
  return newId
}
