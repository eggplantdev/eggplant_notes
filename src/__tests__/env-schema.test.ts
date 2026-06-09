import { describe, expect, it } from 'vitest'

import { clientSchema, serverSchema } from '@/lib/env-schema'

// Guards the build-time env contract: next.config.ts runs serverSchema.parse(process.env) at
// build/dev-start, so these assertions pin which server vars are mandatory. The token API's 500 bug
// traced to an unvalidated SUPABASE_JWT_SECRET — this keeps it in the fail-fast set.
const validEnv = {
  EMAIL_HOST: 'smtp.example.com',
  EMAIL_PASS: 'secret',
  EMAIL_TO: 'me@example.com',
  SUPABASE_JWT_SECRET: 'x'.repeat(32),
}

describe('serverSchema', () => {
  it('accepts a fully-populated server env', () => {
    expect(serverSchema.safeParse(validEnv).success).toBe(true)
  })

  it('requires SUPABASE_JWT_SECRET', () => {
    const withoutSecret = {
      EMAIL_HOST: validEnv.EMAIL_HOST,
      EMAIL_PASS: validEnv.EMAIL_PASS,
      EMAIL_TO: validEnv.EMAIL_TO,
    }
    expect(serverSchema.safeParse(withoutSecret).success).toBe(false)
  })

  it('rejects a SUPABASE_JWT_SECRET shorter than 32 chars (HS256 floor)', () => {
    expect(serverSchema.safeParse({ ...validEnv, SUPABASE_JWT_SECRET: 'tooshort' }).success).toBe(
      false,
    )
  })
})

const validClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NEXT_PUBLIC_SITE_URL: 'https://clc.example.com',
  NEXT_PUBLIC_EMAIL_USER: 'sender@example.com',
}

describe('clientSchema', () => {
  it('accepts a fully-populated client env', () => {
    expect(clientSchema.safeParse(validClientEnv).success).toBe(true)
  })

  it('defaults NEXT_PUBLIC_SITE_URL to localhost when absent', () => {
    const rest = {
      NEXT_PUBLIC_SUPABASE_URL: validClientEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: validClientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_EMAIL_USER: validClientEnv.NEXT_PUBLIC_EMAIL_USER,
    }
    const parsed = clientSchema.safeParse(rest)
    expect(parsed.success && parsed.data.NEXT_PUBLIC_SITE_URL).toBe('http://127.0.0.1:3000')
  })

  // Regression: a deployment URL like 'https:clc.example.com' (missing the // after the scheme)
  // is silently normalized by z.url()/new URL() and would otherwise pass — then break as a raw
  // href/redirect (reset-password origin, OAuth callback, skill BASE line). Caught in the portfolio
  // repo's NEXT_PUBLIC_FRONTEND_URL. The schema must reject it for both http(s) deployment URLs.
  it('rejects an http(s) URL missing the // authority separator', () => {
    for (const key of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
      const bad = { ...validClientEnv, [key]: 'https:clc.example.com' }
      expect(clientSchema.safeParse(bad).success, key).toBe(false)
    }
  })
})
