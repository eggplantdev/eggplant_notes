import { createHash, randomBytes } from 'node:crypto'

export const TOKEN_PREFIX = 'clc_'

// 256-bit random token, base64url, `clc_`-prefixed (GitHub-PAT style). Only the hash is ever stored;
// the raw value is shown to the minting operator once. node:crypto keeps this server-only.
export function generateToken(): { raw: string; hash: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { raw, hash: hashToken(raw) }
}

// SHA-256 is correct here, not a slow KDF: a 256-bit random token has no low-entropy guess space, so
// the only job is a fast, non-reversible lookup key. Deterministic → one raw always maps to one row.
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}
