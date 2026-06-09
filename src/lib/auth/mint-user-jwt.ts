import { SignJWT } from 'jose'

// Mints a short-lived, user-scoped JWT the Supabase API accepts, so a token-authed request runs under
// RLS as that user (auth.uid() = sub) — the ownership wall stays in the DB, never in app code.
//
// The secret is read LAZILY (mirrors lib/crypto/aes-gcm.ts): importing this module never crashes a
// context where the var is absent, and tests can set it before calling. Local + legacy-hosted projects
// use the HS256 shared secret; an asymmetric-signing-keys project swaps this for ES256 + the project
// signing key — a deploy-time change at this one call site, not an architecture change.

const TOKEN_TTL_SECONDS = 120 // the JWT only needs to outlive a single API request

function getSecret(): Uint8Array {
  const raw = process.env.SUPABASE_JWT_SECRET
  if (!raw) throw new Error('SUPABASE_JWT_SECRET is not set')
  return new TextEncoder().encode(raw)
}

export async function mintUserJwt(userId: string): Promise<string> {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret())
}
