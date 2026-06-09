'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { memoryCardInputSchema, noteIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Bulk-insert the accepted AI-generated cards under a note (after the user's preview/edit). Mirrors
// createMemoryCard's subject seeding (card inherits the note's subject); RLS + the user_id default
// guard ownership. Capped to bound the insert.
const cardsSchema = z.array(memoryCardInputSchema).min(1).max(20)

export async function createCardsForNote(noteId: unknown, cards: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, noteId)
  if (!parsedId.success) return parsedId
  const parsedCards = validateInput(cardsSchema, cards)
  if (!parsedCards.success) return parsedCards

  const supabase = await createClient()
  const { data: note } = await supabase
    .from('notes')
    .select('subject_id')
    .eq('id', parsedId.data)
    .single()
  const rows = parsedCards.data.map((c) => ({
    ...c,
    note_id: parsedId.data,
    subject_id: note?.subject_id ?? null,
  }))
  const { error } = await supabase.from('memory_cards').insert(rows)
  if (error) {
    console.error('[createCardsForNote] insert error', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/notes/${parsedId.data}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
