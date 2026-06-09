'use server'

import { revalidatePath } from 'next/cache'

import { updateMemoryCardCore } from '@/features/memory-cards/update-memory-card-core'
import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { createClient } from '@/lib/supabase/server'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Cookie-client entry point for the card edit form. The field write + forced-unlink live in
// updateMemoryCardCore (shared with PATCH /api/memory-cards/:id), which self-detects the unlink from the
// card's current row. This wrapper validates, then revalidates the old note page (if any) + redirects.
export async function updateMemoryCard(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return parsedId
  const parsed = validateInput(cardWithSubjectSchema, input)
  if (!parsed.success) return parsed

  const supabase = await createClient()
  const result = await updateMemoryCardCore(supabase, parsedId.data, parsed.data)
  if ('error' in result) return { success: false, error: result.error }

  if (result.previousNoteId) revalidatePath(`/notes/${result.previousNoteId}`)
  revalidatePath('/memory-cards')
  toastRedirect('/memory-cards', 'card-saved')
}
