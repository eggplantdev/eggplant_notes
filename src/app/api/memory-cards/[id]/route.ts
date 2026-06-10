import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import {
  authError,
  deleteRowResponse,
  errorJson,
  readJsonBody,
} from '@/features/api-tokens/route-helpers'
import { updateMemoryCardCore } from '@/features/memory-cards/update-memory-card-core'
import { cardWithSubjectSchema, memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { validateInput } from '@/lib/validate'

// PATCH /api/memory-cards/:id — edit a card's fields and/or its subject. Invariant: an attached card
// (note_id set) shares its note's subject, so changing the subject of an attached card UNLINKS it
// (becomes standalone). updateMemoryCardCore self-detects that from the card's current row.
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

  const result = await updateMemoryCardCore(auth.supabase, parsedId.data, parsed.data)
  if ('error' in result) {
    if (result.notFound) return errorJson(404, 'Card not found')
    return errorJson(500, 'Failed to update card')
  }
  return NextResponse.json({ id: result.id })
}

// RLS-scoped: non-owned/nonexistent → 404.
export async function DELETE(request: Request, ctx: RouteContext<'/api/memory-cards/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(memoryCardIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  return deleteRowResponse(auth.supabase, 'memory_cards', parsedId.data, 'Card')
}
