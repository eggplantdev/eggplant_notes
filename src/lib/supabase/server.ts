import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

// Per-request Supabase client for Server Components, Server Actions, and route handlers.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if the proxy refreshes user sessions.
        }
      },
    },
  })
}

// Request-memoized auth read. getUser() validates the JWT over the network against Supabase
// Auth, so calling it in both the (protected) layout (the gate) and a page (e.g. the dashboard
// email) is two round-trips per request. React's cache() dedupes them within a single server
// render: layout and page share one result, one network call.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
