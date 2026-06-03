'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, noteSubjectIdSchema } from '@/features/notes/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Assign (or clear) a note's subject inline from the note detail view — a focused write that
// touches only subject_id + position, unlike updateNote (which also rewrites title/content and
// redirects). RLS scopes the update to the owner and the extended `with check` rejects pointing
// at a subject you don't own. position mirrors updateNote: Date.now() appends to the new
// subject's end, null clears it on unassign — only (re)derived when the subject actually changes
// (read the note's OWN row, not the banned max() aggregate, so there's no append race). No
// redirect: the picker stays on the detail page and the revalidated server render reflects it.
export async function assignNoteSubject(
  id: string,
  subjectId: string | null,
): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return parsedId
  const parsedSubject = validateInput(noteSubjectIdSchema, subjectId)
  if (!parsedSubject.success) return parsedSubject
  const nextSubjectId = parsedSubject.data ?? null

  const supabase = await createClient()

  const { data: current } = await supabase
    .from('notes')
    .select('subject_id')
    .eq('id', parsedId.data)
    .maybeSingle()

  const patch: Database['public']['Tables']['notes']['Update'] = {
    subject_id: nextSubjectId,
    updated_at: new Date().toISOString(),
  }
  if (current?.subject_id !== nextSubjectId) {
    patch.position = nextSubjectId ? Date.now() : null
  }

  const { error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', parsedId.data)
    .select('id')
    .single()
  if (error) {
    console.error('[assignNoteSubject] update error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  revalidatePath(`/notes/${parsedId.data}`)
  return { success: true }
}
