'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Delete a memory card (FR-014). Its review_events are removed by the DB FK `on delete
// cascade` — no app-side cascade needed. RLS scopes the delete to the owner; `.select()
// .single()` confirms a row was actually removed. `noteId` is the detail page to revalidate;
// `/memory-cards` is also revalidated so the standalone listing drops the row when deleted there.
export async function deleteMemoryCard(noteId: string, id: string): Promise<ActionResultT> {
  const result = await runTableAction(memoryCardIdSchema, id, (supabase, validId) =>
    supabase.from('memory_cards').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
