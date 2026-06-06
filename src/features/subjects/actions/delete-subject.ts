'use server'

import { revalidatePath } from 'next/cache'

import { subjectIdSchema } from '@/features/subjects/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Member notes are DETACHED, not deleted — the FK `on delete set null` nulls their `subject_id`
// (stale `position` is ignored while unassigned; reassigning recomputes it). Revalidate /notes
// too, since detached notes resurface in the notes list.
export async function deleteSubject(id: string): Promise<ActionResultT> {
  const result = await runTableAction(subjectIdSchema, id, (supabase, validId) =>
    supabase.from('subjects').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/subjects')
  revalidatePath('/notes')
  toastRedirect('/subjects', 'subject-deleted')
}
