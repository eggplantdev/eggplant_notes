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
  // update-password is reached via a recovery session, so it must stay public too.
  const isPublic =
    isAuthRoute || pathname.startsWith('/api/auth/') || matchesPath(pathname, '/update-password')

  // Optimistic gate; the (protected) layout is the authoritative backstop.
  if (!user && !isPublic) return redirectTo('/sign-in', request, response)
  if (user && isAuthRoute) return redirectTo('/dashboard', request, response)

  return response
}

export const config = {
  matcher: [
    // Matches everything except _next assets/images. /api IS intentionally included — the
    // /api/auth/confirm callback must run through the proxy to propagate its session cookie, so
    // any future /api/* route also runs here; add it to `isPublic` if it must work signed-out.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
