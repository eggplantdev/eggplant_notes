'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Drop a card's source-note link (standalone-memory-cards): note_id → null. The card and its own
// subject survive untouched. RLS scopes the update to the owner (a non-owned id matches zero rows
// → `.single()` errors → failure). Used from BOTH sides — the card-edit page and the note's card
// section — so neither redirects; each refreshes its own view. Revalidate the card list always,
// plus the previously-linked note path when the caller knows it (best-effort).
export async function unlinkCardFromNote(id: string, noteId?: string): Promise<ActionResultT> {
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return parsedId

  const supabase = await createClient()
  const { error } = await supabase
    .from('memory_cards')
    .update({ note_id: null })
    .eq('id', parsedId.data)
    .select('id')
    .single()
  if (error) {
    console.error('[unlinkCardFromNote] PostgREST error', error)
    return { success: false, error: error.message }
  }

  if (noteId) revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
