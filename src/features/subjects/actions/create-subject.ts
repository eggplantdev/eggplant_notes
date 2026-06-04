'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { subjectInputSchema } from '@/features/subjects/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Mirrors createNote. `user_id` is NOT sent — the DB defaults it to auth.uid() and RLS
// `with check` guards it. On success, revalidate the list and redirect to the new
// subject (redirect throws, so the form only ever observes the failure branch).
export async function createSubject(input: unknown): Promise<ActionResultT> {
  const result = await runTableAction(subjectInputSchema, input, (supabase, data) =>
    supabase.from('subjects').insert(data).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/subjects')
  redirect(`/subjects/${result.data.id}?toast=subject-saved`)
}
