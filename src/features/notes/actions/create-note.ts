'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { noteInputSchema } from '@/features/notes/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// First mutation in the repo. `user_id` is NOT sent — the DB defaults it to auth.uid()
// and RLS `with check` guards it, so a client can never spoof ownership. On success we
// revalidate the list and redirect to the new note's detail page (redirect throws, so
// the form only ever observes the failure branch).
export async function createNote(input: unknown): Promise<ActionResultT> {
  const result = await runTableAction(noteInputSchema, input, (supabase, data) =>
    supabase.from('notes').insert(data).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/notes')
  redirect(`/notes/${result.data.id}`)
}
