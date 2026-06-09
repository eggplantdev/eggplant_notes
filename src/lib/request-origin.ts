import { SITE_URL } from '@/lib/env'

// Reconstruct the deployment origin from the request's host header, so a URL we emit (a skill's BASE
// line, an OAuth callback) points at the SAME origin the request arrived on — prod on prod, a preview
// URL on a preview deploy, the e2e port under test — instead of a pinned env value. Falls back to
// SITE_URL when there's no host (non-request context). Same logic as openrouter connect.ts.
export function originFromHeaders(headers: Headers): string {
  const host = headers.get('host')
  if (!host) return SITE_URL
  // Loopback hosts speak plain http locally; everything else is https. Cover the IPv4 forms plus the
  // IPv6 loopback (`[::1]:port`) so an IPv6 dev/e2e bind doesn't get a broken https:// origin.
  const isLoopback = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].some((h) => host.startsWith(h))
  const proto = isLoopback ? 'http' : 'https'
  return `${proto}://${host}`
}
