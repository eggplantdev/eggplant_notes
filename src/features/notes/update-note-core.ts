import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteInputT } from '@/features/notes/schemas'
import type { Database } from '@/lib/supabase/types'

// Unlink is applied first so detached cards keep their old subject (they fall out of the note_id match before move runs). 'all' moves every still-linked card by note_id — no id enumeration.
export type CardActionsT = { move: string[] | 'all'; unlink: string[] }

// Shared by cookie action and PATCH route. Errors returned as values (never thrown); notFound prevents existence leak.
export async function updateNoteCore(
  supabase: SupabaseClient<Database>,
  id: string,
  input: NoteInputT,
  cardActions?: CardActionsT,
): Promise<{ id: string; subjectChanged: boolean } | { error: string; notFound?: boolean }> {
  const patch: Database['public']['Tables']['notes']['Update'] = {
    title: input.title,
    content: input.content,
  }
  // Only (re)derive `position` when the subject actually changes, so a plain title/content edit never
  // reorders the note. Reading the note's OWN row to detect the change has no append race.
  let subjectChanged = false
  if (input.subject_id !== undefined) {
    const { data: current } = await supabase
      .from('notes')
      .select('subject_id')
      .eq('id', id)
      .maybeSingle()
    patch.subject_id = input.subject_id
    subjectChanged = current?.subject_id !== input.subject_id
    // position is null IFF subject_id is null — a move to a subject stamps it, a move to None clears it.
    if (subjectChanged) patch.position = input.subject_id ? Date.now() : null
  }

  const { data: updated, error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[updateNoteCore] PostgREST error', error)
    return { error: error.message }
  }
  if (!updated) return { error: 'Note not found', notFound: true }

  if (subjectChanged && cardActions) {
    // Unlink FIRST so detached cards keep their OLD subject: once note_id is null they no longer match
    // the `note_id` filter below, so the move never restamps them. (Move-first would stamp the new
    // subject onto cards we're about to unlink.)
    if (cardActions.unlink.length > 0) {
      const { error: unlinkError } = await supabase
        .from('memory_cards')
        .update({ note_id: null })
        .eq('note_id', id)
        .in('id', cardActions.unlink)
      if (unlinkError) {
        console.error('[updateNoteCore] card unlink error', unlinkError)
        return { error: unlinkError.message }
      }
    }
    if (cardActions.move === 'all') {
      const { error: moveError } = await supabase
        .from('memory_cards')
        .update({ subject_id: input.subject_id })
        .eq('note_id', id)
      if (moveError) {
        console.error('[updateNoteCore] card move error', moveError)
        return { error: moveError.message }
      }
    } else if (cardActions.move.length > 0) {
      const { error: moveError } = await supabase
        .from('memory_cards')
        .update({ subject_id: input.subject_id })
        .eq('note_id', id)
        .in('id', cardActions.move)
      if (moveError) {
        console.error('[updateNoteCore] card move error', moveError)
        return { error: moveError.message }
      }
    }
  }

  return { id: updated.id, subjectChanged }
}
