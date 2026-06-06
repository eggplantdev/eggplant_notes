'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// review_events cascade via the DB FK `on delete cascade`. `.select().single()` confirms a row was
// actually removed (RLS scopes the delete to the owner). `noteId` is optional — a standalone card
// has none; when present it revalidates the source note's detail page.
export async function deleteMemoryCard(id: string, noteId?: string): Promise<ActionResultT> {
  const result = await runTableAction(memoryCardIdSchema, id, (supabase, validId) =>
    supabase.from('memory_cards').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  if (noteId) revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
