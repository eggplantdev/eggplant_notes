'use server'

import { revalidatePath } from 'next/cache'

import { insertNoteWithChecks } from '@/features/notes/insert-note-with-checks'
import { createNoteWithChecksSchema } from '@/features/notes/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the create-note form. The actual note+checks write lives in
// insertNoteWithChecks (shared with POST /api/notes); here we just validate, run it, and redirect.
// redirect throws, so the form only ever observes the failure branch.
export async function createNote(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(createNoteWithChecksSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  let newId: string
  try {
    newId = await insertNoteWithChecks(supabase, parsed.data)
  } catch (error) {
    console.error('[createNote] create_note_with_checks error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create note',
    }
  }

  revalidatePath('/notes')
  toastRedirect(`/notes/${newId}`, 'note-saved')
}
