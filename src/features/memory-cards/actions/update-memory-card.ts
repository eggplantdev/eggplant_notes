'use server'

import { revalidatePath } from 'next/cache'

import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Edit a memory card's content AND subject (standalone-memory-cards). No longer note-scoped — a
// card may be standalone — so it keys off the card `id` alone; RLS scopes the update to the owner
// (a non-owned id matches zero rows → `.single()` errors → returned as failure). `subject_id` is
// written as the form submits it (RLS rejects a subject the caller doesn't own); `note_id` is not
// in the payload, so the source link is preserved. The updated row's `note_id` is returned so the
// source note's detail path is revalidated only when the card is linked. SM-2 columns are never
// touched. On success we redirect to /memory-cards (the unified card surface; redirect throws, so
// the form only observes the failure branch — the create-note pattern).
export async function updateMemoryCard(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(cardWithSubjectSchema, input, (supabase, data) =>
    supabase.from('memory_cards').update(data).eq('id', parsedId.data).select('note_id').single(),
  )
  if (!result.success) return result

  if (result.data.note_id) revalidatePath(`/notes/${result.data.note_id}`)
  revalidatePath('/memory-cards')
  toastRedirect('/memory-cards', 'card-saved')
}
