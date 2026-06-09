import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson, readJsonBody } from '@/features/api-tokens/route-helpers'
import { createSubjectCore } from '@/features/subjects/create-subject-core'
import { getSubjects } from '@/features/subjects/queries'
import { subjectInputSchema } from '@/features/subjects/schemas'
import { validateInput } from '@/lib/validate'

// GET /api/subjects — list the caller's subjects (id, title) so an agent can pick or create one before
// adding a note/card. RLS-scoped to the token's user; reuses the canonical getSubjects query (injectable
// client) so the column set + ordering stay in one place.
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  try {
    const subjects = await getSubjects(auth.supabase)
    return NextResponse.json({ subjects })
  } catch (error) {
    console.error('[GET /api/subjects] read error', error)
    return errorJson(500, 'Failed to list subjects')
  }
}

// POST /api/subjects — create a subject (first-class, vs. the inline `subject_title` side effect of
// POST /api/notes). Reuses createSubjectCore (shared with the form action); RLS owns ownership.
export async function POST(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const parsedBody = await readJsonBody(request)
  if (!parsedBody.ok) return parsedBody.res

  const parsed = validateInput(subjectInputSchema, parsedBody.body)
  if (!parsed.success) return errorJson(400, parsed.error)

  try {
    const { id } = await createSubjectCore(auth.supabase, parsed.data)
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/subjects] insert error', error)
    return errorJson(500, 'Failed to create subject')
  }
}
