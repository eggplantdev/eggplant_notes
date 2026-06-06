'use server'

import { revalidatePath } from 'next/cache'

import { createNoteWithChecksSchema } from '@/features/notes/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// `user_id` is NOT sent — the DB defaults it to auth.uid() and RLS `with check` guards it, so a
// client can't spoof ownership. `position = Date.now()` appends to the subject's end without a
// max() read (no append race); unassigned notes have null position. Uses an RPC (not
// runTableAction, which is single-table) to insert the note + its checks in one transaction, so
// the envelope is hand-rolled. redirect throws, so the form only ever observes the failure branch.
export async function createNote(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(createNoteWithChecksSchema, input)
  if (!parsed.success) return parsed
  const { note, checks } = parsed.data

  const supabase = await createClient()
  const { data: newId, error } = await supabase.rpc('create_note_with_checks', {
    p_note: { ...note, position: note.subject_id ? Date.now() : null },
    p_checks: checks,
  })
  if (error) {
    console.error('[createNote] create_note_with_checks error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  toastRedirect(`/notes/${newId}`, 'note-saved')
}
