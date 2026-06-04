'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema } from '@/features/notes/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Delete a note. Attached topic_checks (and their review_events) are removed by the DB
// FK `on delete cascade` — no app-side cascade needed (FR-010). RLS scopes the delete to
// the owner. `.select().single()` returns the deleted row so runTableAction confirms a
// row was actually removed. On success, revalidate the list and return to where the delete
// was triggered: the flat /notes list by default, or a caller-supplied path (the S-15 subject
// view passes its /subjects/[id] so the docs context survives the delete — when it does, the
// subjects subtree is also revalidated so the sidebar drops the gone note).
export async function deleteNote(id: string, redirectTo = '/notes'): Promise<ActionResultT> {
  const result = await runTableAction(noteIdSchema, id, (supabase, validId) =>
    supabase.from('notes').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/notes')
  if (redirectTo !== '/notes') revalidatePath('/subjects', 'layout')
  toastRedirect(redirectTo, 'note-deleted')
}
