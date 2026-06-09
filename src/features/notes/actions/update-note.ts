'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, noteInputSchema } from '@/features/notes/schemas'
import { updateNoteCore, type CardActionsT } from '@/features/notes/update-note-core'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the note edit form. The patch/subject-change/card fan-out logic lives
// in updateNoteCore (shared with PATCH /api/notes/:id); this wrapper validates, then revalidates +
// redirects. redirect throws, so the form only ever observes the failure branch.
export async function updateNote(
  id: string,
  input: unknown,
  cardActions?: CardActionsT,
): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return parsedId
  const parsed = validateInput(noteInputSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const result = await updateNoteCore(supabase, parsedId.data, parsed.data, cardActions)
  if ('error' in result) return { success: false, error: result.error }

  // Card moves/unlinks happened only on a real subject change with actions provided.
  if (result.subjectChanged && cardActions) revalidatePath('/memory-cards')
  revalidatePath('/notes')
  revalidatePath(`/notes/${parsedId.data}`)
  toastRedirect(`/notes/${parsedId.data}`, 'note-saved')
}
