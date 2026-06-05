'use server'

import { revalidatePath } from 'next/cache'

import { topicCheckIdSchema } from '@/features/topic-checks/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Delete a topic check (FR-014). Its review_events are removed by the DB FK `on delete
// cascade` — no app-side cascade needed. RLS scopes the delete to the owner; `.select()
// .single()` confirms a row was actually removed. `noteId` is the detail page to revalidate;
// `/topic-checks` is also revalidated so the standalone listing drops the row when deleted there.
export async function deleteTopicCheck(noteId: string, id: string): Promise<ActionResultT> {
  const result = await runTableAction(topicCheckIdSchema, id, (supabase, validId) =>
    supabase.from('topic_checks').delete().eq('id', validId).select('id').single(),
  )
  if (!result.success) return result

  revalidatePath(`/notes/${noteId}`)
  revalidatePath('/topic-checks')
  return { success: true }
}
