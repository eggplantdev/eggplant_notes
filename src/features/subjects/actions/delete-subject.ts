'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { subjectIdSchema } from '@/features/subjects/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Delete a subject. Member notes are DETACHED, not deleted — the FK `on delete set null`
// nulls their `subject_id` at the DB (their `position` is left stale but ignored once
// unassigned; reassigning recomputes it). RLS scopes the delete to the owner. Revalidate
// both /subjects and /notes, since detached notes resurface in the notes list.
export async function deleteSubject(id: string): Promise<ActionResultT> {
  const result = await runTableAction(subjectIdSchema, id, (supabase, validId) =>
    supabase.from('subjects').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/subjects')
  revalidatePath('/notes')
  redirect('/subjects')
}
