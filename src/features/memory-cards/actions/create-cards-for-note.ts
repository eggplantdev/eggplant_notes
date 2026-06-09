'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { insertCardsForNote } from '@/features/memory-cards/insert-cards-for-note'
import { memoryCardInputSchema, noteIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Bulk-insert the accepted AI-generated cards under a note (after the user's preview/edit). The write
// core (insertCardsForNote) is shared with POST /api/memory-cards. Capped to bound the insert.
const cardsSchema = z.array(memoryCardInputSchema).min(1).max(20)

export async function createCardsForNote(noteId: unknown, cards: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, noteId)
  if (!parsedId.success) return parsedId
  const parsedCards = validateInput(cardsSchema, cards)
  if (!parsedCards.success) return parsedCards

  const supabase = await createClient()
  try {
    await insertCardsForNote(supabase, parsedId.data, parsedCards.data)
  } catch (error) {
    console.error('[createCardsForNote] insert error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create cards',
    }
  }

  revalidatePath(`/notes/${parsedId.data}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
