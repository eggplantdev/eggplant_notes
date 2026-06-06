'use server'

import { revalidatePath } from 'next/cache'

import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Edit a memory card's content AND subject (standalone-memory-cards). Keys off the card `id`
// alone; RLS scopes the update to the owner. Hand-rolls the envelope (not runTableAction) because
// it reads the card's current note for revalidation and can clear the link in the same write.
//
// Invariant: a LINKED card always shares its note's subject. So changing a linked card's subject
// necessarily unlinks it — the form confirms that, then passes `unlinkFromNote`, which sets
// `note_id = null` alongside the new subject. (A standalone card just updates its subject.) The
// old note's path is revalidated from the pre-update read, since the link is gone afterward.
export async function updateMemoryCard(
  id: string,
  input: unknown,
  unlinkFromNote = false,
): Promise<ActionResultT> {
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return parsedId
  const parsed = validateInput(cardWithSubjectSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  // Current note_id for revalidation — lost from the row once we unlink.
  const { data: current } = await supabase
    .from('memory_cards')
    .select('note_id')
    .eq('id', parsedId.data)
    .maybeSingle()

  const patch = unlinkFromNote ? { ...parsed.data, note_id: null } : parsed.data
  const { error } = await supabase
    .from('memory_cards')
    .update(patch)
    .eq('id', parsedId.data)
    .select('id')
    .single()
  if (error) {
    console.error('[updateMemoryCard] PostgREST error', error)
    return { success: false, error: error.message }
  }

  if (current?.note_id) revalidatePath(`/notes/${current.note_id}`)
  revalidatePath('/memory-cards')
  toastRedirect('/memory-cards', 'card-saved')
}
