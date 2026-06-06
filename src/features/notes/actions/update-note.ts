'use server'

import { revalidatePath } from 'next/cache'

import { noteIdSchema, noteInputSchema } from '@/features/notes/schemas'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { toastRedirect } from '@/lib/toast-redirect'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Per-card decisions when a note's subject changes (standalone-memory-cards): each linked card is
// either MOVED to the new subject (stays linked — preserves the invariant that a linked card
// shares its note's subject) or UNLINKED (note_id → null, keeps its current subject, becomes
// standalone). The edit form's dialog collects these.
type CardActionsT = { move: string[]; unlink: string[] }

// Update a note's title + body, and optionally its subject assignment. RLS scopes the update to
// the owner (a non-owned id matches zero rows and `.single()` errors → failure; the extended
// `with check` also rejects pointing at a subject you don't own). Hand-rolls the envelope (not
// runTableAction) because a subject change can fan out into the per-card moves/unlinks above.
export async function updateNote(
  id: string,
  input: unknown,
  cardActions?: CardActionsT,
): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return parsedId
  const parsed = validateInput(noteInputSchema, input)
  if (!parsed.success) return parsed
  const data = parsed.data

  const supabase = await createClient()
  const patch: Database['public']['Tables']['notes']['Update'] = {
    title: data.title,
    content: data.content,
  }
  // Assignment is optional on update. Only (re)derive `position` when the subject actually
  // changes — Date.now() appends to the new subject's end, null clears it on unassign — so a plain
  // title/content edit never reorders the note. Reading the note's OWN row to detect the change is
  // not the max(position) aggregate the F2 fix banned; there is no append race on a single row.
  let subjectChanged = false
  if (data.subject_id !== undefined) {
    const { data: current } = await supabase
      .from('notes')
      .select('subject_id')
      .eq('id', parsedId.data)
      .maybeSingle()
    patch.subject_id = data.subject_id
    subjectChanged = current?.subject_id !== data.subject_id
    if (subjectChanged) patch.position = data.subject_id ? Date.now() : null
  }

  const { error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', parsedId.data)
    .select('id')
    .single()
  if (error) {
    console.error('[updateNote] PostgREST error', error)
    return { success: false, error: error.message }
  }

  // Apply the per-card decisions only on a real subject change. Both writes are scoped to this
  // note's cards (`note_id = id`) on top of RLS. Moved cards take the new subject and stay linked;
  // unlinked cards keep their subject and drop the link.
  if (subjectChanged && cardActions) {
    if (cardActions.move.length > 0) {
      const { error: moveError } = await supabase
        .from('memory_cards')
        .update({ subject_id: data.subject_id })
        .eq('note_id', parsedId.data)
        .in('id', cardActions.move)
      if (moveError) {
        console.error('[updateNote] card move error', moveError)
        return { success: false, error: moveError.message }
      }
    }
    if (cardActions.unlink.length > 0) {
      const { error: unlinkError } = await supabase
        .from('memory_cards')
        .update({ note_id: null })
        .eq('note_id', parsedId.data)
        .in('id', cardActions.unlink)
      if (unlinkError) {
        console.error('[updateNote] card unlink error', unlinkError)
        return { success: false, error: unlinkError.message }
      }
    }
    revalidatePath('/memory-cards')
  }

  revalidatePath('/notes')
  revalidatePath(`/notes/${parsedId.data}`)
  toastRedirect(`/notes/${parsedId.data}`, 'note-saved')
}
