import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

// proxy.ts imports @/lib/env (eager NEXT_PUBLIC_* parse) and @supabase/ssr — neither is available/wanted
// in the unit env, so stub both. getUser resolves NO user: the exact condition under which the proxy
// must 307 a protected PAGE to /sign-in but let an /api/* request through to its own handler.
vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'http://localhost:54321', SUPABASE_ANON_KEY: 'anon' }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}))

const { proxy } = await import('@/proxy')

function reqFor(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

// Regression for the 307→/sign-in bug: the proxy gated /api/* (only /api/auth/* was public), so a
// token request — Bearer header, no session cookie — was bounced to the HTML sign-in page before its
// handler ran. An API must answer JSON (401 from the handler), never a 307 to a page.
describe('proxy /api gate', () => {
  it('does NOT redirect unauthenticated token API routes (handler enforces auth)', async () => {
    for (const path of ['/api/subjects', '/api/notes', '/api/memory-cards', '/api/skill']) {
      const res = await proxy(reqFor(path))
      expect(res.headers.get('location'), `${path} must not redirect`).toBeNull()
      expect(res.status, `${path} must not be a 307`).not.toBe(307)
    }
  })

  it('still redirects an unauthenticated protected PAGE to /sign-in', async () => {
    const res = await proxy(reqFor('/dashboard'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/sign-in')
  })
})
