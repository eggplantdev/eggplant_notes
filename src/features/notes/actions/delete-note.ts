'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema } from '@/features/notes/schemas'
import { runDeleteRow } from '@/lib/supabase/run-delete-row'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Attached memory_cards (and their review_events) cascade at the DB FK — no app-side cascade.
// `.select().single()` returns the deleted row so runTableAction confirms a row was removed.
// redirectTo (default /notes, or the subject view) is just the post-delete destination.
export async function deleteNote(id: string, redirectTo = '/notes'): Promise<ActionResultT> {
  const result = await runDeleteRow(noteIdSchema, 'notes', id)
  if (!result.success) return result

  revalidatePath('/', 'layout')
  toastRedirect(redirectTo, 'note-deleted')
}
