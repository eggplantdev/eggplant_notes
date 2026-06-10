import { describe, expect, it, vi } from 'vitest'

// request-origin.ts imports SITE_URL from @/lib/env (eager NEXT_PUBLIC_* parse), unavailable in the
// unit env — stub it. This helper now feeds BOTH the /api/skill BASE injection and the OpenRouter
// callback_url, so its host→origin mapping is worth pinning.
vi.mock('@/lib/env', () => ({ SITE_URL: 'http://site-url-fallback.test' }))

const { originFromHeaders } = await import('@/lib/request-origin')

function origin(host: string | null) {
  return originFromHeaders(new Headers(host === null ? {} : { host }))
}

describe('originFromHeaders', () => {
  it('uses http for every loopback host form (incl. IPv6 and 0.0.0.0)', () => {
    expect(origin('localhost:3000')).toBe('http://localhost:3000')
    expect(origin('127.0.0.1:3100')).toBe('http://127.0.0.1:3100')
    expect(origin('0.0.0.0:3000')).toBe('http://0.0.0.0:3000')
    expect(origin('[::1]:3000')).toBe('http://[::1]:3000')
  })

  it('uses https for a real deployment host', () => {
    expect(origin('clc.example.com')).toBe('https://clc.example.com')
    expect(origin('my-app-git-preview.vercel.app')).toBe('https://my-app-git-preview.vercel.app')
  })

  it('falls back to SITE_URL when there is no host header', () => {
    expect(origin(null)).toBe('http://site-url-fallback.test')
  })
})
