'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

const reorderInputSchema = z.object({
  noteId: z.guid('Invalid note id'), // shape only; see memory-cards/schemas.ts
  position: z.number(),
})

// Persist one note's new fractional position after a drag — the client sends the midpoint of the
// visible neighbors, the server writes only that one row (no sequence recompute). Returns
// success/error (no redirect) so the optimistic island can revert and surface a message.
export async function reorderNote(noteId: string, position: number): Promise<ActionResultT> {
  const result = await runTableAction(reorderInputSchema, { noteId, position }, (supabase, data) =>
    supabase
      .from('notes')
      .update({ position: data.position })
      .eq('id', data.noteId)
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/', 'layout')
  return { success: true }
}
