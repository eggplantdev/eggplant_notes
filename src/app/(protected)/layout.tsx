import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { createClient } from '@/lib/supabase/server'

// Authoritative server-side gate. The proxy is optimistic (can be bypassed if the
// matcher misses); this re-checks on the server for every protected render.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  return <>{children}</>
}
