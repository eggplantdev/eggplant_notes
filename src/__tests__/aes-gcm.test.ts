import { beforeEach, describe, expect, it, vi } from 'vitest'

// aes-gcm now sources the master key from the validated server env (serverEnv.OPENROUTER_ENC_KEY),
// not raw process.env. Mock that module so importing aes-gcm doesn't trigger a real serverSchema.parse
// and so we control the key per test — getKey() reads the property at call time, so mutating it
// between tests is enough.
vi.mock('@/lib/env.server', () => ({ serverEnv: { OPENROUTER_ENC_KEY: '' } }))

import { decryptSecret, encryptSecret } from '@/lib/crypto/aes-gcm'
import { serverEnv } from '@/lib/env.server'

const VALID_KEY = Buffer.alloc(32, 7).toString('base64') // deterministic 32-byte key (base64)

beforeEach(() => {
  serverEnv.OPENROUTER_ENC_KEY = VALID_KEY
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
    serverEnv.OPENROUTER_ENC_KEY = Buffer.alloc(16).toString('base64')
    expect(() => encryptSecret('x')).toThrow(/32 bytes/)
  })
})
