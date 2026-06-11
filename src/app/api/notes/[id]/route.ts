import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import {
  authError,
  deleteRowResponse,
  errorJson,
  readJsonBody,
} from '@/features/api-tokens/route-helpers'
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
// change every linked card follows the note by default; the caller can detach specific cards via
// `card_actions: { unlink }` (they keep their old subject as standalone). RLS-scoped: non-owned/
// nonexistent → 404.
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

  // On a subject change, every linked card follows the note (`move: 'all'`) except the ids in `unlink`,
  // which detach and keep their old subject. There is no "move only these, leave the rest linked-but-
  // stale" path — that state is unreachable in the UI, so the API mustn't mint it either. `move: 'all'`
  // lets the core sweep by `note_id` with no pre-read to enumerate ids.
  let cardActions: CardActionsT | undefined
  if (noteInput.subject_id !== undefined) {
    cardActions = { move: 'all', unlink: card_actions?.unlink ?? [] }
  }

  const result = await updateNoteCore(auth.supabase, parsedId.data, noteInput, cardActions)
  if ('error' in result) {
    if (result.notFound) return errorJson(404, 'Note not found')
    return errorJson(500, 'Failed to update note')
  }
  // Token-API write: reset server caches so the next request renders fresh (marks paths, no live push).
  revalidatePath('/', 'layout')
  return NextResponse.json({ id: result.id })
}

// FK ON DELETE CASCADE removes linked cards; no app-side fan-out. RLS-scoped: non-owned/nonexistent → 404.
export async function DELETE(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(noteIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  return deleteRowResponse(auth.supabase, 'notes', parsedId.data, 'Note')
}
