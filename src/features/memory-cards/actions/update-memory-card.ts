'use server'

import { revalidatePath } from 'next/cache'

import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Hand-rolls the envelope (not runTableAction) because it reads the card's current note for
// revalidation and can clear the link in the same write. Invariant: a linked card shares its note's
// subject, so changing its subject must unlink it — `unlinkFromNote` then sets `note_id = null`
// alongside the new subject. RLS scopes the update to the owner.
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
  // Read note_id before the write — lost from the row once we unlink.
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
