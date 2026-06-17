import { createHash, randomBytes } from 'node:crypto'

export const TOKEN_PREFIX = 'egg_'

// 256-bit random token, base64url, `egg_`-prefixed (GitHub-PAT style). Only the hash is ever stored;
// Prefix is cosmetic — auth hashes the whole raw string with no prefix gate, so older `clc_` tokens
// minted before the rename still resolve. Re-mint to drop the legacy prefix.
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
