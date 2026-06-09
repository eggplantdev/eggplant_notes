import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson } from '@/features/api-tokens/route-helpers'
import { noteIdSchema } from '@/features/notes/schemas'
import { validateInput } from '@/lib/validate'

// GET /api/notes/:id — read a note's full content + its cards back (closes the verify gap: the API could
// write notes/cards but never read them). RLS-scoped: a non-owned/nonexistent id → 404.
export async function GET(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const { data: note, error: noteError } = await auth.supabase
    .from('notes')
    .select('id,title,content,subject_id')
    .eq('id', parsedId.data)
    .maybeSingle()
  if (noteError) {
    console.error('[GET /api/notes/:id] read error', noteError)
    return errorJson(500, 'Failed to read note')
  }
  if (!note) return errorJson(404, 'Note not found')

  const { data: cards, error: cardsError } = await auth.supabase
    .from('memory_cards')
    .select('id,prompt,example,code_context,subject_id,note_id')
    .eq('note_id', parsedId.data)
  if (cardsError) {
    console.error('[GET /api/notes/:id] cards read error', cardsError)
    return errorJson(500, 'Failed to read note cards')
  }

  return NextResponse.json({ note, cards })
}

// DELETE /api/notes/:id — delete a note. The FK `ON DELETE CASCADE` removes its cards (no app-side
// fan-out). RLS-scoped: non-owned/nonexistent → 404.
export async function DELETE(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const { data, error } = await auth.supabase
    .from('notes')
    .delete()
    .eq('id', parsedId.data)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[DELETE /api/notes/:id] delete error', error)
    return errorJson(500, 'Failed to delete note')
  }
  if (!data) return errorJson(404, 'Note not found')
  return NextResponse.json({ id: data.id })
}
