import type { SupabaseClient } from '@supabase/supabase-js'

import type { CardWithSubjectInputT } from '@/features/memory-cards/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared card-update core — the field write plus the forced-unlink (a linked card shares its note's
// subject, so changing its subject must clear `note_id`). Everything from the updateMemoryCard action
// minus revalidate/redirect, so the cookie action and the PATCH route share it. The core self-detects
// the forced-unlink from the card's own current row (mirrors updateNoteCore detecting its subject
// change) — neither caller has to pre-read or compute it. Errors returned as values; `previousNoteId`
// (read before the write, lost once unlinked) lets the action revalidate the old note page; `notFound`
// lets the route 404 without leaking existence.
export async function updateMemoryCardCore(
  supabase: SupabaseClient<Database>,
  id: string,
  input: CardWithSubjectInputT,
): Promise<{ id: string; previousNoteId: string | null } | { error: string; notFound?: boolean }> {
  // Read the current link + subject before the write (both lost once we unlink) to derive the forced
  // unlink: a linked card whose subject changes must detach (note_id → null) to keep the invariant.
  const { data: current } = await supabase
    .from('memory_cards')
    .select('note_id,subject_id')
    .eq('id', id)
    .maybeSingle()

  const unlinkFromNote = current?.note_id != null && input.subject_id !== current.subject_id
  const patch = unlinkFromNote ? { ...input, note_id: null } : input
  const { data: updated, error } = await supabase
    .from('memory_cards')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[updateMemoryCardCore] PostgREST error', error)
    return { error: error.message }
  }
  if (!updated) return { error: 'Card not found', notFound: true }

  return { id: updated.id, previousNoteId: current?.note_id ?? null }
}
