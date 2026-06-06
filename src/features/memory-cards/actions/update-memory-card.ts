'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema, memoryCardInputSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Edit a memory card (FR-013). RLS scopes the update to the owner (a non-owned id matches
// zero rows and `.single()` errors → returned as failure). `id` is validated separately from
// the body; SM-2 columns are never touched here. `noteId` is the detail page to revalidate —
// it is not a security boundary (the row is found by `id` + RLS), so it stays unvalidated.
export async function updateMemoryCard(
  noteId: string,
  id: string,
  input: unknown,
): Promise<ActionResultT> {
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(memoryCardInputSchema, input, (supabase, data) =>
    supabase.from('memory_cards').update(data).eq('id', parsedId.data).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath(`/notes/${noteId}`)
  revalidatePath('/memory-cards')
  return { success: true }
}
