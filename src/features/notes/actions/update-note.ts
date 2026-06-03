'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { noteIdSchema, noteInputSchema } from '@/features/notes/schemas'
import { runNoteAction } from '@/features/notes/run-note-action'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Update a note's title + body. RLS scopes the update to the owner (a non-owned id
// matches zero rows and `.single()` errors → returned as failure). `id` is validated
// separately from the body; on success we revalidate list + detail and redirect back to
// the note.
export async function updateNote(id: string, input: unknown): Promise<ActionResultT> {
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return parsedId

  const result = await runNoteAction(noteInputSchema, input, (supabase, data) =>
    supabase
      .from('notes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', parsedId.data)
      .select('id')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/notes')
  revalidatePath(`/notes/${parsedId.data}`)
  redirect(`/notes/${parsedId.data}`)
}
