'use server'

import { revalidatePath } from 'next/cache'

import { cardWithSubjectSchema } from '@/features/memory-cards/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

// Create a memory card with NO source note (standalone-memory-cards). `user_id` is NOT sent — the
// DB defaults it to auth.uid() and RLS `with check` guards both ownership and that the chosen
// subject is the caller's. `note_id` is null; the card owns its subject directly. Mirrors
// createNote: revalidate the list, then redirect to /memory-cards (redirect throws, so the form
// only ever observes the failure branch).
export async function createStandaloneCard(input: unknown): Promise<ActionResultT> {
  const result = await runTableAction(cardWithSubjectSchema, input, (supabase, data) =>
    supabase
      .from('memory_cards')
      .insert({ ...data, note_id: null })
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/memory-cards')
  toastRedirect('/memory-cards', 'card-created')
}
