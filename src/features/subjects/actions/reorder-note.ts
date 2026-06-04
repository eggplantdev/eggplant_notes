'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

const reorderInputSchema = z.object({
  noteId: z.guid('Invalid note id'), // shape only; see topic-checks/schemas.ts
  position: z.number(),
})

// Persist one note's new fractional position after a drag. The client computes the midpoint
// from the visible neighbors and sends it; the server writes only that single row (RLS scopes
// to the owner — and the F1 with-check still requires the note's subject to be the caller's).
// No sequence recompute. Returns success/error (no redirect) so the optimistic island can
// revert and surface a message on failure; the user stays on the subject page.
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

  revalidatePath('/subjects/[id]', 'page')
  // Also refresh the S-15 docs-view sidebar, which renders the ordered note list in the
  // read layout — without this a hard reload of /subjects/[id]/read would show stale order.
  revalidatePath('/subjects/[id]/read', 'layout')
  return { success: true }
}
