'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema } from '@/features/notes/schemas'
import { runDeleteRow } from '@/lib/supabase/run-delete-row'
import type { ActionResultT } from '@/types/action'

// Attached memory_cards (and their review_events) cascade at the DB FK — no app-side cascade.
// `.select().single()` returns the deleted row so runTableAction confirms a row was removed.
// The post-delete destination is the dialog's to client-navigate to (it already owns the URL).
export async function deleteNote(id: string): Promise<ActionResultT> {
  const result = await runDeleteRow(noteIdSchema, 'notes', id)
  if (!result.success) return result

  revalidatePath('/', 'layout')
  return { success: true }
}
