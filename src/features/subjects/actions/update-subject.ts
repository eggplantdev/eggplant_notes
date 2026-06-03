'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { subjectIdSchema, subjectInputSchema } from '@/features/subjects/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Rename / edit description. RLS scopes the update to the owner (a non-owned id matches
// zero rows and `.single()` errors → failure). `id` is validated separately from the body.
export async function updateSubject(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(subjectIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(subjectInputSchema, input, (supabase, data) =>
    supabase
      .from('subjects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', parsedId.data)
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/subjects')
  revalidatePath(`/subjects/${parsedId.data}`)
  redirect(`/subjects/${parsedId.data}`)
}
