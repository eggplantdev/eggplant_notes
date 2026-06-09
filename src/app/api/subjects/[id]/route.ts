import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { subjectIdSchema, subjectInputSchema } from '@/features/subjects/schemas'
import { updateSubjectCore } from '@/features/subjects/update-subject-core'
import { validateInput } from '@/lib/validate'

// PATCH /api/subjects/:id — rename / re-describe a subject. Reuses updateSubjectCore (shared with the
// form action). RLS-scoped: a non-owned/nonexistent id updates zero rows → 404 (don't leak existence).
export async function PATCH(request: Request, ctx: RouteContext<'/api/subjects/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(subjectIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res
  const parsed = validateInput(subjectInputSchema, parsedBody.body)
  if (!parsed.success) return errorJson(400, parsed.error)

  try {
    const row = await updateSubjectCore(auth.supabase, parsedId.data, parsed.data)
    if (!row) return errorJson(404, 'Subject not found')
    return NextResponse.json({ id: row.id })
  } catch (error) {
    console.error('[PATCH /api/subjects/:id] update error', error)
    return errorJson(500, 'Failed to update subject')
  }
}

// DELETE /api/subjects/:id — delete a subject. The FK `ON DELETE SET NULL` unfiles its member notes/cards
// (no app-side fan-out). RLS-scoped: non-owned/nonexistent → 404.
export async function DELETE(request: Request, ctx: RouteContext<'/api/subjects/[id]'>) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { id } = await ctx.params
  const parsedId = validateInput(subjectIdSchema, id)
  if (!parsedId.success) return errorJson(400, parsedId.error)

  const { data, error } = await auth.supabase
    .from('subjects')
    .delete()
    .eq('id', parsedId.data)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[DELETE /api/subjects/:id] delete error', error)
    return errorJson(500, 'Failed to delete subject')
  }
  if (!data) return errorJson(404, 'Subject not found')
  return NextResponse.json({ id: data.id })
}
