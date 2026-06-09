import { describe, expect, it } from 'vitest'

import { generateToken, hashToken, TOKEN_PREFIX } from '@/features/api-tokens/token'

describe('api token helpers', () => {
  it('generates a prefixed token with a matching sha256 hash', () => {
    const { raw, hash } = generateToken()
    expect(raw.startsWith(TOKEN_PREFIX)).toBe(true)
    // 32 random bytes → 43 base64url chars, plus the prefix
    expect(raw.length).toBeGreaterThan(TOKEN_PREFIX.length + 40)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashToken(raw))
    expect(hash).not.toBe(raw)
  })

  it('hash is deterministic; raw is unique per call', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a.raw).not.toBe(b.raw)
    expect(a.hash).not.toBe(b.hash)
    expect(hashToken(a.raw)).toBe(a.hash)
  })
})
