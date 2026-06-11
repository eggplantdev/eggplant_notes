'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, memoryCardInputSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// `user_id` is NOT sent — the DB defaults it to auth.uid() and RLS `with check` guards it. No
// redirect: the user stays on the note detail page, so we revalidate and return success. The
// card's subject_id is seeded from the note's subject as a default (not a lock — re-fileable on the
// edit page); reading it off the RLS-scoped note guarantees the caller owns it.
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

  revalidatePath('/', 'layout')
  return { success: true }
}
