import { describe, expect, it } from 'vitest'

import { clientSchema, serverSchema } from '@/lib/env-schema'

// Guards the build-time env contract: next.config.ts parses both schemas at build/dev-start, so these
// pin which vars are mandatory. EVERY var is required — no defaults — so a missing one fails the parse
// and `next build` fails fast instead of shipping a broken deploy (the token API 500 traced to an
// unvalidated SUPABASE_JWT_SECRET; the OpenRouter prod outage to an unvalidated OPENROUTER_ENC_KEY).
const validEnv = {
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_PASS: 'secret',
  EMAIL_TO: 'me@example.com',
  SUPABASE_JWT_SECRET: 'x'.repeat(32),
  OPENROUTER_ENC_KEY: 'enc-key', // schema checks presence only; the 32-byte decode lives in aes-gcm
}

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NEXT_PUBLIC_SITE_URL: 'https://clc.example.com',
  NEXT_PUBLIC_EMAIL_USER: 'sender@example.com',
}

const without = (obj: Record<string, unknown>, key: string) => {
  const copy = { ...obj }
  delete copy[key]
  return copy
}

describe('serverSchema', () => {
  it('accepts a fully-populated server env', () => {
    expect(serverSchema.safeParse(validEnv).success).toBe(true)
  })

  it.each(Object.keys(validEnv))('requires %s — parse fails when it is absent', (key) => {
    expect(serverSchema.safeParse(without(validEnv, key)).success).toBe(false)
  })

  it('rejects a SUPABASE_JWT_SECRET shorter than 32 chars (HS256 floor)', () => {
    expect(serverSchema.safeParse({ ...validEnv, SUPABASE_JWT_SECRET: 'tooshort' }).success).toBe(
      false,
    )
  })
})

describe('clientSchema', () => {
  it('accepts a fully-populated client env', () => {
    expect(clientSchema.safeParse(validClientEnv).success).toBe(true)
  })

  // Incl. NEXT_PUBLIC_SITE_URL: its default was removed so each environment must set its own origin —
  // prod can no longer silently fall back to localhost in baked links.
  it.each(Object.keys(validClientEnv))('requires %s — parse fails when it is absent', (key) => {
    expect(clientSchema.safeParse(without(validClientEnv, key)).success).toBe(false)
  })

  // Regression: a deployment URL like 'https:clc.example.com' (missing the // after the scheme) is
  // silently normalized by z.url()/new URL() and would otherwise pass — then break as a raw href/
  // redirect (reset-password origin, OAuth callback, skill BASE line). Caught in the portfolio repo's
  // NEXT_PUBLIC_FRONTEND_URL. The schema must reject it for both http(s) deployment URLs.
  it('rejects an http(s) URL missing the // authority separator', () => {
    for (const key of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
      const bad = { ...validClientEnv, [key]: 'https:clc.example.com' }
      expect(clientSchema.safeParse(bad).success, key).toBe(false)
    }
  })
})
