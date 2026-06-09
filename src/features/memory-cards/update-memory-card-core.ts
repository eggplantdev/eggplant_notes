import type { SupabaseClient } from '@supabase/supabase-js'

import type { CardWithSubjectInputT } from '@/features/memory-cards/schemas'
import type { Database } from '@/lib/supabase/types'

// Shared card-update core — the field write plus the forced-unlink (a linked card shares its note's
// subject, so changing its subject must clear `note_id`). Everything from the updateMemoryCard action
// minus revalidate/redirect, so the cookie action and the PATCH route share it. The caller decides
// `unlinkFromNote` (the UI form computes it; the route derives it server-side). Errors returned as
// values; `previousNoteId` (read before the write, lost once unlinked) lets the action revalidate the
// old note page; `notFound` lets the route 404 without leaking existence.
export async function updateMemoryCardCore(
  supabase: SupabaseClient<Database>,
  id: string,
  input: CardWithSubjectInputT,
  unlinkFromNote: boolean,
): Promise<{ id: string; previousNoteId: string | null } | { error: string; notFound?: boolean }> {
  // Read note_id before the write — lost from the row once we unlink.
  const { data: current } = await supabase
    .from('memory_cards')
    .select('note_id')
    .eq('id', id)
    .maybeSingle()

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
