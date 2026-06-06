'use server'

import { revalidatePath } from 'next/cache'

import { subjectIdSchema, subjectInputSchema } from '@/features/subjects/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// RLS scopes the update to the owner — a non-owned id matches zero rows and `.single()` errors
// → failure.
export async function updateSubject(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(subjectIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(subjectInputSchema, input, (supabase, data) =>
    supabase.from('subjects').update(data).eq('id', parsedId.data).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath('/subjects')
  revalidatePath(`/subjects/${parsedId.data}`)
  toastRedirect(`/subjects/${parsedId.data}`, 'subject-saved')
}
