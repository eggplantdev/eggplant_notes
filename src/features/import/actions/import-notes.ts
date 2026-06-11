'use server'

import { revalidatePath } from 'next/cache'

import { importNotesSchema } from '@/features/import/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Bulk-commit previewed notes under a subject (existing or new) in one transaction via the
// import_notes RPC. Mirrors createNote: `user_id` is never sent (DB defaults it to auth.uid(), RLS
// guards it); redirect throws, so the form only ever observes the failure branch.
export async function importNotes(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(importNotesSchema, input)
  if (!parsed.success) return parsed
  const { subject, notes } = parsed.data

  const supabase = await createClient()
  const { data: subjectId, error } = await supabase.rpc('import_notes', {
    p_subject: subject,
    p_notes: notes,
  })
  if (error) {
    console.error('[importNotes] import_notes error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  toastRedirect(`/subjects/${subjectId}`, 'notes-imported')
}
