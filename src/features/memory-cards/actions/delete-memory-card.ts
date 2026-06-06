'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Delete a memory card (FR-014). Its review_events are removed by the DB FK `on delete
// cascade` — no app-side cascade needed. RLS scopes the delete to the owner; `.select()
// .single()` confirms a row was actually removed. `/memory-cards` is always revalidated so the
// listing drops the row; `noteId` (optional — a standalone card has none) revalidates the source
// note's detail page when the delete came from there.
export async function deleteMemoryCard(id: string, noteId?: string): Promise<ActionResultT> {
  const result = await runTableAction(memoryCardIdSchema, id, (supabase, validId) =>
    supabase.from('memory_cards').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  if (noteId) revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
