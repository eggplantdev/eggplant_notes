import { describe, expect, it, vi } from 'vitest'

// Reproduces the empty-500 bug: a VALID token passes resolve_api_token, then mintUserJwt throws
// (e.g. SUPABASE_JWT_SECRET unset/misconfigured). Before the fix that throw was uncaught and the route
// returned a bodyless 500; authenticateRequest must instead return a structured error the route maps to
// a JSON 500. Mock the JWT mint to throw and the token-resolution client to succeed — no env needed.
vi.mock('@/lib/auth/mint-user-jwt', () => ({
  mintUserJwt: async () => {
    throw new Error('SUPABASE_JWT_SECRET is not set')
  },
}))
vi.mock('@/lib/supabase/from-access-token', () => ({
  anonClient: () => ({ rpc: async () => ({ data: 'user-123', error: null }) }),
  clientForAccessToken: () => ({}),
}))

const { authenticateRequest } = await import('@/features/api-tokens/authenticate-request')

function reqWithToken() {
  return new Request('http://localhost/api/subjects', {
    headers: { authorization: 'Bearer egg_validlooking' },
  })
}

describe('authenticateRequest — JWT mint failure', () => {
  it('returns a structured 500 instead of throwing when minting fails', async () => {
    const result = await authenticateRequest(reqWithToken())
    expect(result).toEqual({ error: { status: 500, message: 'Auth configuration error' } })
  })
})
