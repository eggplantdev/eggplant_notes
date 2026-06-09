import { beforeAll, describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret } from '@/lib/crypto/aes-gcm'

// A deterministic 32-byte key (base64) for the test; the module reads it lazily at call time.
beforeAll(() => {
  process.env.OPENROUTER_ENC_KEY = Buffer.alloc(32, 7).toString('base64')
})

describe('aes-gcm encryptSecret / decryptSecret', () => {
  it('round-trips a secret', () => {
    const secret = 'sk-or-v1-deadbeef'
    expect(decryptSecret(encryptSecret(secret))).toBe(secret)
  })

  it('uses a fresh IV per call (same input → different ciphertext)', () => {
    const a = encryptSecret('same')
    const b = encryptSecret('same')
    expect(a.ciphertext).not.toBe(b.ciphertext)
    expect(a.iv).not.toBe(b.iv)
  })

  it('throws on a tampered auth tag', () => {
    const enc = encryptSecret('secret')
    const tamperedTag = Buffer.from(enc.authTag, 'base64')
    tamperedTag[0] ^= 0xff
    expect(() => decryptSecret({ ...enc, authTag: tamperedTag.toString('base64') })).toThrow()
  })

  it('throws when the key is the wrong length', () => {
    const saved = process.env.OPENROUTER_ENC_KEY
    process.env.OPENROUTER_ENC_KEY = Buffer.alloc(16).toString('base64')
    expect(() => encryptSecret('x')).toThrow(/32 bytes/)
    process.env.OPENROUTER_ENC_KEY = saved
  })
})
