import type { SupabaseClient } from '@supabase/supabase-js'

import { hashToken } from '@/features/api-tokens/token'
import { mintUserJwt } from '@/lib/auth/mint-user-jwt'
import { anonClient, clientForAccessToken } from '@/lib/supabase/from-access-token'
import type { Database } from '@/lib/supabase/types'

export type AuthErrorT = { status: number; message: string }
export type AuthResultT =
  | { supabase: SupabaseClient<Database>; userId: string }
  | { error: AuthErrorT }

// The one auth pipeline every token route calls: Bearer token → hash → resolve_api_token (the single
// elevated lookup) → mint a short-lived user JWT → a JWT-scoped client. Returns a structured error
// (the route builds the NextResponse) so this stays framework-light and testable with a plain Request.
export async function authenticateRequest(request: Request): Promise<AuthResultT> {
  const match = (request.headers.get('authorization') ?? '').match(/^Bearer (.+)$/)
  if (!match)
    return { error: { status: 401, message: 'Missing or malformed Authorization header' } }

  const { data: userId, error } = await anonClient().rpc('resolve_api_token', {
    p_hash: hashToken(match[1]),
  })
  if (error) {
    console.error('[authenticateRequest] resolve_api_token error', error)
    return { error: { status: 500, message: 'Token resolution failed' } }
  }
  if (!userId) return { error: { status: 401, message: 'Invalid, expired, or revoked token' } }

  const jwt = await mintUserJwt(userId)
  return { supabase: clientForAccessToken(jwt), userId }
}
