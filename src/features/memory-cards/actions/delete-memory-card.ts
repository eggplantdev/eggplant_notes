'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runDeleteRow } from '@/lib/supabase/run-delete-row'
import type { ActionResultT } from '@/types/action'

// review_events cascade via the DB FK `on delete cascade`. `.select().single()` confirms a row was
// actually removed (RLS scopes the delete to the owner). `noteId` is optional — a standalone card
// has none; when present it revalidates the source note's detail page.
export async function deleteMemoryCard(id: string, noteId?: string): Promise<ActionResultT> {
  const result = await runDeleteRow(memoryCardIdSchema, 'memory_cards', id)
  if (!result.success) return result

  if (noteId) revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
