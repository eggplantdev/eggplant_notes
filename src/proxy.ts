import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

// `/update-password` is deliberately NOT here: the recovery flow lands there WITH a session, so
// bouncing a signed-in user off it would trap them on the page they need.
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/reset-password']

// Exact match or true subpath — NOT a bare prefix, so `/sign-in-evil` can't slip through.
function matchesPath(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(route + '/')
}

// Carries over the cookies refreshed on `response` — a bare NextResponse.redirect would drop them
// and kill the session.
function redirectTo(pathname: string, request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

// Next.js 16 renamed `middleware` -> `proxy`. Refreshes the Supabase session cookie on every
// matched request and gates protected paths.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: do not run code between client creation and getUser() —
  // reordering breaks silent session refresh and causes random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = AUTH_ROUTES.some((route) => matchesPath(pathname, route))
  // Every /api/* route self-enforces auth in its handler and must answer with JSON, never a 307 to the
  // HTML sign-in page — so the proxy refreshes their cookie but never gates them. Token routes
  // (/api/subjects, /api/notes, /api/memory-cards) carry a `Bearer egg_…` header and NO session cookie,
  // so gating them here would bounce the agent before authenticateRequest ever runs; /api/skill 401s
  // itself via getCurrentUser. update-password is reached via a recovery session, so it stays public too.
  const isPublic =
    isAuthRoute ||
    pathname.startsWith('/api/') ||
    matchesPath(pathname, '/update-password') ||
    // /logo is a standalone brand-exploration gallery with no user data — viewable signed-out.
    matchesPath(pathname, '/logo')

  // Optimistic gate; the (protected) layout is the authoritative backstop.
  if (!user && !isPublic) return redirectTo('/sign-in', request, response)
  if (user && isAuthRoute) return redirectTo('/dashboard', request, response)

  return response
}

export const config = {
  matcher: [
    // Matches everything except _next assets/images. /api IS intentionally included so the proxy can
    // refresh the session cookie (e.g. the /api/auth/confirm callback) — but every /api/* route is
    // treated as public at the gate (see isPublic) and enforces its own auth in the handler, so an API
    // request is never 307'd to the HTML sign-in page.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
