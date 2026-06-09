import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson } from '@/features/api-tokens/route-helpers'
import { memoryCardIdSchema } from '@/features/memory-cards/schemas'
import { validateInput } from '@/lib/validate'

// DELETE /api/memory-cards/:id — delete a card. RLS-scoped: non-owned/nonexistent → 404.
// (PATCH is added in Phase 2 — subject-switching with the forced-unlink invariant.)
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
