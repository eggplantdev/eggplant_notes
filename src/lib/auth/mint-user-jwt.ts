import { SignJWT } from 'jose'

import { serverEnv } from '@/lib/env.server'

// Mints a short-lived, user-scoped JWT the Supabase API accepts, so a token-authed request runs under
// RLS as that user (auth.uid() = sub) — the ownership wall stays in the DB, never in app code.
//
// The secret comes from the validated server env (serverEnv.SUPABASE_JWT_SECRET) — never raw
// process.env — so presence is guaranteed at build by serverSchema (mirrors lib/crypto/aes-gcm.ts).
// Local + legacy-hosted projects use the HS256 shared secret; an asymmetric-signing-keys project swaps
// this for ES256 + the project signing key — a deploy-time change at this call site, not architecture.

const TOKEN_TTL_SECONDS = 120 // the JWT only needs to outlive a single API request

function getSecret(): Uint8Array {
  return new TextEncoder().encode(serverEnv.SUPABASE_JWT_SECRET)
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
