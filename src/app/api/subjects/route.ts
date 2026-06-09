import { NextResponse } from 'next/server'

import { authenticateRequest } from '@/features/api-tokens/authenticate-request'
import { authError, errorJson } from '@/features/api-tokens/route-helpers'

// GET /api/subjects — list the caller's subjects (id, title) so an agent can pick or create one before
// adding a note/card. RLS-scoped to the token's user.
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if ('error' in auth) return authError(auth.error)

  const { data, error } = await auth.supabase.from('subjects').select('id,title')
  if (error) {
    console.error('[GET /api/subjects] read error', error)
    return errorJson(500, 'Failed to list subjects')
  }
  return NextResponse.json({ subjects: data })
}
