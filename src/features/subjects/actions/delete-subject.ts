'use server'

import { revalidatePath } from 'next/cache'

import { subjectIdSchema } from '@/features/subjects/schemas'
import { runDeleteRow } from '@/lib/supabase/run-delete-row'
import type { ActionResultT } from '@/types/action'

// Member notes are DETACHED, not deleted — the FK `on delete set null` nulls their `subject_id`
// (stale `position` is ignored while unassigned; reassigning recomputes it).
export async function deleteSubject(id: string): Promise<ActionResultT> {
  const result = await runDeleteRow(subjectIdSchema, 'subjects', id)
  if (!result.success) return result

  revalidatePath('/', 'layout')
  return { success: true }
}
