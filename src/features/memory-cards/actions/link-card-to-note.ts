'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema, noteIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Inverse of unlinkCardFromNote: attach a standalone card to an existing note. The card adopts the
// note's subject so the invariant "a linked card shares its note's subject" holds by construction —
// the note is the source of truth, mirroring insertCardsForNote. RLS scopes every read/write to the
// owner (a non-owned note or card matches zero rows → `.single()` errors → failure). No redirect:
// the three callers refresh their own view.
export async function linkCardToNote(cardId: string, noteId: string): Promise<ActionResultT> {
  const parsedCardId = validateInput(memoryCardIdSchema, cardId)
  if (!parsedCardId.success) return parsedCardId
  const parsedNoteId = validateInput(noteIdSchema, noteId)
  if (!parsedNoteId.success) return parsedNoteId

  const supabase = await createClient()

  // Read the note's subject first — the card inherits it. A missing/not-owned note errors here.
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('subject_id')
    .eq('id', parsedNoteId.data)
    .single()
  if (noteError) {
    console.error('[linkCardToNote] note lookup error', noteError)
    return { success: false, error: noteError.message }
  }

  const { error } = await supabase
    .from('memory_cards')
    .update({ note_id: parsedNoteId.data, subject_id: note.subject_id })
    .eq('id', parsedCardId.data)
    .select('id')
    .single()
  if (error) {
    console.error('[linkCardToNote] PostgREST error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
