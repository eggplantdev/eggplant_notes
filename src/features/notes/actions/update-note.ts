'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, noteInputSchema } from '@/features/notes/schemas'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { Database } from '@/lib/supabase/types'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Update a note's title + body, and optionally its subject assignment. RLS scopes the
// update to the owner (a non-owned id matches zero rows and `.single()` errors → failure;
// the extended `with check` also rejects pointing at a subject you don't own). `id` is
// validated separately from the body; on success we revalidate list + detail and redirect.
export async function updateNote(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runTableAction(noteInputSchema, input, async (supabase, data) => {
    const patch: Database['public']['Tables']['notes']['Update'] = {
      title: data.title,
      content: data.content,
    }
    // Assignment is optional on update. Only (re)derive `position` when the subject
    // actually changes — Date.now() appends to the new subject's end, null clears it on
    // unassign — so a plain title/content edit never reorders the note. Reading the
    // note's OWN row to detect the change is not the max(position) aggregate the F2 fix
    // banned; there is no append race on a single owned row.
    if (data.subject_id !== undefined) {
      const { data: current } = await supabase
        .from('notes')
        .select('subject_id')
        .eq('id', parsedId.data)
        .maybeSingle()
      patch.subject_id = data.subject_id
      if (current?.subject_id !== data.subject_id) {
        patch.position = data.subject_id ? Date.now() : null
      }
    }
    return supabase.from('notes').update(patch).eq('id', parsedId.data).select('id').single()
  })
  if (!result.success) return result

  revalidatePath('/notes')
  revalidatePath(`/notes/${parsedId.data}`)
  toastRedirect(`/notes/${parsedId.data}`, 'note-saved')
}
