'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Drops a card's source-note link (note_id → null); the card and its subject survive. RLS scopes
// the update to the owner (a non-owned id matches zero rows → `.single()` errors → failure). No
// redirect — both callers (card-edit page, note's card section) refresh their own view. `noteId` is
// retained for Phase 2's per-path bust; Phase 1's nuclear bust doesn't read it.
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

  revalidatePath('/', 'layout')
  return { success: true }
}
