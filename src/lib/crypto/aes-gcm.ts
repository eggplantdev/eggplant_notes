import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { serverEnv } from '@/lib/env.server'

// Server-only AES-256-GCM for secrets at rest (the per-user OpenRouter key). node:crypto makes this
// unusable in the browser by construction; the key never reaches the client. The 32-byte master key
// is sourced from the validated server env (serverEnv.OPENROUTER_ENC_KEY) — never raw process.env —
// so presence is guaranteed at build by serverSchema and getKey only verifies the decoded length.

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // GCM standard nonce length

export type EncryptedSecretT = {
  ciphertext: string
  iv: string
  authTag: string
}

function getKey(): Buffer {
  // serverEnv.OPENROUTER_ENC_KEY is validated for presence by serverSchema at build (env-schema.ts),
  // so it's a guaranteed string here; we only verify the 32-byte base64 decode.
  const key = Buffer.from(serverEnv.OPENROUTER_ENC_KEY, 'base64')
  if (key.length !== 32) throw new Error('OPENROUTER_ENC_KEY must decode to 32 bytes (base64)')
  return key
}

// Fresh random IV per call (GCM must never reuse an IV under one key); all parts returned base64 for
// text-column storage.
export function encryptSecret(plain: string): EncryptedSecretT {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

// Throws on a tampered ciphertext/tag (GCM authentication) — a corrupted or forged row fails closed
// rather than returning garbage.
export function decryptSecret({ ciphertext, iv, authTag }: EncryptedSecretT): string {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ])
  return plain.toString('utf8')
}
