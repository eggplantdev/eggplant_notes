'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, memoryCardInputSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Attach a memory card to a note (FR-012). Like createNote, `user_id` is NOT sent — the DB
// defaults it to auth.uid() and RLS `with check` guards it. The SM-2 scheduling columns are
// also left unset (their F-02 defaults stand; S-03 owns that write path). Unlike createNote
// we do NOT redirect — the user stays on the note detail page — so we revalidate it and
// return success, letting the section island reset its add/edit form.
//
// The card's subject_id is SEEDED from the note's own subject (standalone-memory-cards):
// the app owns this write — there is no DB trigger — and it's a default, not a lock (the
// user can re-file the card later via the card edit page). RLS still rejects a subject the
// caller doesn't own, but reading it off the (RLS-scoped) note guarantees ownership here.
export async function createMemoryCard(noteId: string, input: unknown): Promise<ActionResultT> {
  const parsedNoteId = validateInput(noteIdSchema, noteId)
  if (!parsedNoteId.success) return parsedNoteId

  const result = await runTableAction(memoryCardInputSchema, input, async (supabase, data) => {
    const { data: note } = await supabase
      .from('notes')
      .select('subject_id')
      .eq('id', parsedNoteId.data)
      .single()
    return supabase
      .from('memory_cards')
      .insert({ ...data, note_id: parsedNoteId.data, subject_id: note?.subject_id ?? null })
      .select('id')
      .single()
  })
  if (!result.success) return result

  revalidatePath(`/notes/${parsedNoteId.data}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
