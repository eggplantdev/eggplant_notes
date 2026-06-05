'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, topicCheckInputSchema } from '@/features/topic-checks/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Attach a topic check to a note (FR-012). Like createNote, `user_id` is NOT sent — the DB
// defaults it to auth.uid() and RLS `with check` guards it. The SM-2 scheduling columns are
// also left unset (their F-02 defaults stand; S-03 owns that write path). Unlike createNote
// we do NOT redirect — the user stays on the note detail page — so we revalidate it and
// return success, letting the section island reset its add/edit form.
export async function createTopicCheck(noteId: string, input: unknown): Promise<ActionResultT> {
  const parsedNoteId = validateInput(noteIdSchema, noteId)
  if (!parsedNoteId.success) return parsedNoteId

  const result = await runTableAction(topicCheckInputSchema, input, (supabase, data) =>
    supabase
      .from('topic_checks')
      .insert({ note_id: parsedNoteId.data, ...data })
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath(`/notes/${parsedNoteId.data}`)
  revalidatePath('/topic-checks')
  return { success: true }
}
