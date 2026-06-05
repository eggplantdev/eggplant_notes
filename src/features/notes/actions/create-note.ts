'use server'

import { revalidatePath } from 'next/cache'

import { createNoteWithChecksSchema } from '@/features/notes/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// S-07: creates a note together with its staged memory cards in one atomic write. `user_id` is
// NOT sent — the DB defaults it to auth.uid() and RLS `with check` guards it, so a client can
// never spoof ownership. When the note is created already assigned to a subject,
// `position = Date.now()` appends it to the end of that subject (no max() read, no append race);
// unassigned notes have a null position. The create_note_with_checks RPC inserts the note,
// captures its id, and inserts every check against it in one transaction (all-or-nothing), then
// returns the new id. Deliberately does NOT use runTableAction: that wrapper is single-schema →
// single PostgREST write → .select().single(); this is a multi-table write through an RPC, so the
// {success}/error envelope is mirrored by hand (same pattern as rateMemoryCard). On success we
// revalidate the list and redirect to the new note (redirect throws, so the form only ever
// observes the failure branch).
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
