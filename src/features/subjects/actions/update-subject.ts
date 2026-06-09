'use server'

import { revalidatePath } from 'next/cache'

import { subjectIdSchema, subjectInputSchema } from '@/features/subjects/schemas'
import { updateSubjectCore } from '@/features/subjects/update-subject-core'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the subject edit form. The update lives in updateSubjectCore (shared
// with PATCH /api/subjects/:id). RLS scopes the update to the owner — a non-owned id matches zero rows
// (→ undefined → failure). redirect throws, so the form only ever observes the failure branch.
export async function updateSubject(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(subjectIdSchema, id)
  if (!parsedId.success) return parsedId

  const parsed = validateInput(subjectInputSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  let row: { id: string } | undefined
  try {
    row = await updateSubjectCore(supabase, parsedId.data, parsed.data)
  } catch (error) {
    console.error('[updateSubject] update error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update subject',
    }
  }
  if (!row) return { success: false, error: 'Subject not found' }

  revalidatePath('/subjects')
  revalidatePath(`/subjects/${parsedId.data}`)
  toastRedirect(`/subjects/${parsedId.data}`, 'subject-saved')
}
