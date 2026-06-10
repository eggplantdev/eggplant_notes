import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regression guard (auth surface) for the localhost-bounce bug: signUp() passed no `emailRedirectTo`, so
// GoTrue's `{{ .RedirectTo }}` in the confirmation email was empty and the link fell back to the project
// Site URL (localhost on the hosted project). The fix derives the origin from the request and routes the
// link through /api/auth/confirm?type=email. We assert the exact `emailRedirectTo` handed to `auth.signUp`
// — that argument IS the email's redirect target; the rendered email is GoTrue's downstream concern, not
// observable in a unit (nor in E2E — there's no mailbox in the flow). The oracle is the requirement
// (link points at the request origin's confirm route), not the call's current shape.
const { signUpSpy, headerStore } = vi.hoisted(() => ({
  // Typed to take one arg so `mock.calls[0][0]` is the signUp payload, not an out-of-range index on
  // a zero-param tuple (TS2493).
  signUpSpy: vi.fn(async (_payload?: unknown) => ({ error: null })),
  headerStore: { current: new Map<string, string>() },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { signUp: signUpSpy } })),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: (key: string) => headerStore.current.get(key) ?? null })),
}))

// SITE_URL is the dev fallback used only when the request carries no origin header.
vi.mock('@/lib/env', () => ({ SITE_URL: 'http://localhost:3000' }))

// Success path calls toastRedirect → redirect() → throws NEXT_REDIRECT; stub it so the test can assert the
// auth.signUp argument without the framework redirect throw getting in the way.
vi.mock('@/lib/toast-redirect', () => ({ toastRedirect: vi.fn() }))

import { signUp } from '@/features/auth/actions/sign-up'

const VALID = { email: 'user@example.com', password: 'secret88' }

beforeEach(() => {
  signUpSpy.mockClear()
  headerStore.current = new Map()
})

describe('signUp — confirmation email redirect target (regression)', () => {
  it('builds emailRedirectTo from the request origin', async () => {
    headerStore.current.set('origin', 'https://app.example.com')
    await signUp(VALID)

    expect(signUpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: 'https://app.example.com/api/auth/confirm?type=email' },
      }),
    )
  })

  it('falls back to SITE_URL when the request has no origin header', async () => {
    await signUp(VALID)

    expect(signUpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: 'http://localhost:3000/api/auth/confirm?type=email' },
      }),
    )
  })

  it('never leaves emailRedirectTo unset — the localhost-bounce the bug hinged on', async () => {
    // The original bug: no options at all → GoTrue defaults RedirectTo to the Site URL. A truthy,
    // confirm-route-shaped value is what stops that fallback.
    headerStore.current.set('origin', 'https://app.example.com')
    await signUp(VALID)

    const arg = signUpSpy.mock.calls[0]?.[0] as
      | { options?: { emailRedirectTo?: string } }
      | undefined
    expect(arg?.options?.emailRedirectTo).toMatch(/\/api\/auth\/confirm\?type=email$/)
  })
})
