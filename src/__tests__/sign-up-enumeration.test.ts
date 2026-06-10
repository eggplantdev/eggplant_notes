import { beforeEach, describe, expect, it, vi } from 'vitest'

// Hardening fix (1) / R1 auth-abuse (test-plan §2): sign-up must NOT reveal whether an email already
// has an account (user enumeration). Supabase's `auth.signUp` returns "User already registered" for a
// taken email; `signUp` collapses every auth-layer error to one neutral message so an attacker can't
// distinguish "taken" from any other failure. We stub only `createClient` (server-only + cookie-bound)
// and drive `auth.signUp`'s error directly, so the real sanitizer wiring in sign-up.ts is what's under
// test. The oracle is the requirement (no enumeration), not the code's current string.
const NEUTRAL = 'Could not create your account. If you already have one, try signing in.'

const { authErrorRef } = vi.hoisted(() => ({
  authErrorRef: { current: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp: vi.fn(async () => ({ error: authErrorRef.current })) },
  })),
}))

import { signUp } from '@/features/auth/actions/sign-up'

const VALID = { email: 'user@example.com', password: 'secret88' }

beforeEach(() => {
  authErrorRef.current = null
})

describe('signUp — user-enumeration guard (hardening fix 1, test-plan §2)', () => {
  it('collapses "User already registered" to the neutral message', async () => {
    authErrorRef.current = { message: 'User already registered' }
    const result = await signUp(VALID)

    expect(result).toEqual({ success: false, error: NEUTRAL })
    // The enumeration leak this guards against: the raw "taken" signal must not survive to the client.
    expect(JSON.stringify(result)).not.toContain('already registered')
  })

  it('collapses any other auth error to the SAME neutral message', async () => {
    // Identical output for a taken email and an unrelated failure is what makes the two
    // indistinguishable — that indistinguishability is the whole defense.
    authErrorRef.current = { message: 'Database error saving new user' }
    const result = await signUp(VALID)

    expect(result).toEqual({ success: false, error: NEUTRAL })
    expect(JSON.stringify(result)).not.toContain('Database error')
  })

  it('surfaces a validation error directly (only auth errors get collapsed)', async () => {
    // The sanitizer must mask the auth layer ONLY — a bad-input message stays user-visible for inline
    // form display, and the auth call is never reached.
    const result = await signUp({ email: 'not-an-email', password: 'secret88' })

    expect(result).toEqual({ success: false, error: 'Enter a valid email address' })
  })
})
