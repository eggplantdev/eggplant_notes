import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson } from '@/features/api-tokens/route-helpers'
import { getSubjects } from '@/features/subjects/queries'

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
