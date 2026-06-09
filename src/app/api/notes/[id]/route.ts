import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { patchNoteBodySchema } from '@/features/api-tokens/schemas'
import { noteIdSchema } from '@/features/notes/schemas'
import { updateNoteCore, type CardActionsT } from '@/features/notes/update-note-core'
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

// PATCH /api/notes/:id — edit a note's title/content and/or move it between subjects. On a subject
// change the linked cards come along by default (move-all); the caller can override per-card via
// `card_actions: { move, unlink }`. RLS-scoped: non-owned/nonexistent → 404.
export async function PATCH(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res
  const parsed = validateInput(patchNoteBodySchema, parsedBody.body)
  if (!parsed.success) return errorJson(400, parsed.error)

  const { card_actions, ...noteInput } = parsed.data

  // Move-all default: a subject change with no explicit plan moves every linked card with the note.
  // Reading the linked card ids here (not in the core) keeps "cards follow their note" a route concern
  // — the UI passes its own per-card decisions and never hits this branch.
  let cardActions: CardActionsT | undefined = card_actions
  if (noteInput.subject_id !== undefined && !cardActions) {
    const { data: linked, error: linkedError } = await auth.supabase
      .from('memory_cards')
      .select('id')
      .eq('note_id', parsedId.data)
    if (linkedError) {
      console.error('[PATCH /api/notes/:id] linked-card read error', linkedError)
      return errorJson(500, 'Failed to read linked cards')
    }
    cardActions = { move: linked.map((c) => c.id), unlink: [] }
  }

  const result = await updateNoteCore(auth.supabase, parsedId.data, noteInput, cardActions)
  if ('error' in result) {
    if (result.notFound) return errorJson(404, 'Note not found')
    return errorJson(500, 'Failed to update note')
  }
  return NextResponse.json({ id: result.id })
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
