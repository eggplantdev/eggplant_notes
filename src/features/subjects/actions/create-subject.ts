'use server'

import { revalidatePath } from 'next/cache'

import { createSubjectCore } from '@/features/subjects/create-subject-core'
import { subjectInputSchema } from '@/features/subjects/schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { validateInput } from '@/lib/validate'
import type { RedirectResultT } from '@/types/action'

// Cookie-client entry point for the create-subject form. The insert lives in createSubjectCore (shared
// with POST /api/subjects). `user_id` is NOT sent — the DB defaults it to auth.uid() and RLS `with check`
// guards it. Returns the new subject's id (server-born) so the form client-navigates to it.
export async function createSubject(input: unknown): Promise<RedirectResultT> {
  const parsed = validateInput(subjectInputSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const result = await createSubjectCore(supabase, parsed.data)
  if ('error' in result) return { success: false, error: result.error }

  revalidatePath('/', 'layout')
  return { success: true, redirectTo: `/subjects/${result.id}` }
}
