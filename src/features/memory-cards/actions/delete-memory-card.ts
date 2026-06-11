'use server'

import { revalidatePath } from 'next/cache'

import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { runDeleteRow } from '@/lib/supabase/run-delete-row'
import type { ActionResultT } from '@/types/action'

// review_events cascade via the DB FK `on delete cascade`. `.select().single()` confirms a row was
// actually removed (RLS scopes the delete to the owner). `noteId` (the source note, when deleted from a
// note's card section) is retained for Phase 2's per-path bust; Phase 1's nuclear bust doesn't read it.
export async function deleteMemoryCard(id: string, noteId?: string): Promise<ActionResultT> {
  const result = await runDeleteRow(memoryCardIdSchema, 'memory_cards', id)
  if (!result.success) return result

  revalidatePath('/', 'layout')
  return { success: true }
}
