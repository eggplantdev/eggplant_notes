import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

// Auth pages a signed-in user has no business on -> bounce them to the dashboard.
// `/update-password` is deliberately NOT here: the recovery flow lands there WITH a
// session, so bouncing it would trap the user off the page they need.
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/reset-password']

// Redirect while preserving the cookies refreshed on `response`, so the session
// survives the redirect (a bare NextResponse.redirect would drop them).
function redirectTo(pathname: string, request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

// Next.js 16 renamed `middleware` -> `proxy`; runtime is nodejs (not configurable here).
// Refreshes the Supabase session cookie on every matched request and gates protected paths.
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
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route))
  // Public = auth pages + the email-link callback + update-password (reached via a
  // recovery session, so it must not redirect to /sign-in either).
  const isPublic =
    isAuthRoute || pathname.startsWith('/api/auth/') || pathname.startsWith('/update-password')

  // Optimistic gate (the (protected) layout is the authoritative backstop):
  // signed-out on a protected path -> sign-in; signed-in on an auth page -> dashboard.
  if (!user && !isPublic) return redirectTo('/sign-in', request, response)
  if (user && isAuthRoute) return redirectTo('/dashboard', request, response)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
