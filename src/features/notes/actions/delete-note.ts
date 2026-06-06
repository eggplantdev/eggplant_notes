'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema } from '@/features/notes/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Attached memory_cards (and their review_events) cascade at the DB FK — no app-side cascade.
// `.select().single()` returns the deleted row so runTableAction confirms a row was removed.
// A caller-supplied redirectTo (subject view) revalidates the subjects subtree too, so the
// sidebar drops the gone note.
export async function deleteNote(id: string, redirectTo = '/notes'): Promise<ActionResultT> {
  const result = await runTableAction(noteIdSchema, id, (supabase, validId) =>
    supabase.from('notes').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/notes')
  if (redirectTo !== '/notes') revalidatePath('/subjects', 'layout')
  toastRedirect(redirectTo, 'note-deleted')
}
