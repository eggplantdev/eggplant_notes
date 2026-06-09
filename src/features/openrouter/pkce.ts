import { createHash, randomBytes } from 'node:crypto'

// PKCE (S256) for the OpenRouter OAuth connect. The verifier is generated before the redirect, its
// S256 challenge goes in the auth URL, and the verifier is replayed at the key-exchange step — so a
// stolen authorization code is useless without the verifier we kept server-side.
export const VERIFIER_COOKIE = 'or_pkce_verifier'

export function generateVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}
