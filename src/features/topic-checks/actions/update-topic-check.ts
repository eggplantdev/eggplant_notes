'use server'

import { revalidatePath } from 'next/cache'

import { topicCheckIdSchema, topicCheckInputSchema } from '@/features/topic-checks/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Edit a topic check (FR-013). RLS scopes the update to the owner (a non-owned id matches
// zero rows and `.single()` errors → returned as failure). `id` is validated separately from
// the body; SM-2 columns are never touched here. `noteId` is the detail page to revalidate —
// it is not a security boundary (the row is found by `id` + RLS), so it stays unvalidated.
export async function updateTopicCheck(
  noteId: string,
  id: string,
  input: unknown,
): Promise<ActionResultT> {
  const parsedId = validateInput(topicCheckIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(topicCheckInputSchema, input, (supabase, data) =>
    supabase
      .from('topic_checks')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', parsedId.data)
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath(`/notes/${noteId}`)
  return { success: true }
}
