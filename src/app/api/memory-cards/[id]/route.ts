import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { updateMemoryCardCore } from '@/features/memory-cards/update-memory-card-core'
import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { validateInput } from '@/lib/validate'

// PATCH /api/memory-cards/:id — edit a card's fields and/or its subject. Invariant: an attached card
// (note_id set) shares its note's subject, so changing the subject of an attached card UNLINKS it
// (becomes standalone). The UI computes that in its form; the API has no form, so derive it here.
// RLS-scoped: non-owned/nonexistent → 404.
export async function PATCH(request: Request, ctx: RouteContext<'/api/memory-cards/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res
  const parsed = validateInput(cardWithSubjectSchema, parsedBody.body)
  if (!parsed.success) return errorJson(400, parsed.error)

  // Read the current link + subject to decide the forced unlink (mirrors card-form.tsx). A missing row
  // is non-owned/nonexistent under RLS → 404 before any write.
  const { data: current, error: currentError } = await auth.supabase
    .from('memory_cards')
    .select('note_id,subject_id')
    .eq('id', parsedId.data)
    .maybeSingle()
  if (currentError) {
    console.error('[PATCH /api/memory-cards/:id] read error', currentError)
    return errorJson(500, 'Failed to read card')
  }
  if (!current) return errorJson(404, 'Card not found')

  const unlinkFromNote = current.note_id != null && parsed.data.subject_id !== current.subject_id

  const result = await updateMemoryCardCore(
    auth.supabase,
    parsedId.data,
    parsed.data,
    unlinkFromNote,
  )
  if ('error' in result) {
    if (result.notFound) return errorJson(404, 'Card not found')
    return errorJson(500, 'Failed to update card')
  }
  return NextResponse.json({ id: result.id })
}

// DELETE /api/memory-cards/:id — delete a card. RLS-scoped: non-owned/nonexistent → 404.
export async function DELETE(request: Request, ctx: RouteContext<'/api/memory-cards/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const { data, error } = await auth.supabase
    .from('memory_cards')
    .delete()
    .eq('id', parsedId.data)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[DELETE /api/memory-cards/:id] delete error', error)
    return errorJson(500, 'Failed to delete card')
  }
  if (!data) return errorJson(404, 'Card not found')
  return NextResponse.json({ id: data.id })
}
