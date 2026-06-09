'use server'

import { revalidatePath } from 'next/cache'

import { createSubjectCore } from '@/features/subjects/create-subject-core'
import { subjectInputSchema } from '@/features/subjects/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the create-subject form. The insert lives in createSubjectCore (shared
// with POST /api/subjects). `user_id` is NOT sent — the DB defaults it to auth.uid() and RLS `with check`
// guards it. redirect throws, so the form only ever observes the failure branch.
export async function createSubject(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(subjectInputSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  let id: string
  try {
    ;({ id } = await createSubjectCore(supabase, parsed.data))
  } catch (error) {
    console.error('[createSubject] insert error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subject',
    }
  }

  revalidatePath('/subjects')
  toastRedirect(`/subjects/${id}`, 'subject-saved')
}
