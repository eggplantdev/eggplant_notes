import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppNav } from '@/components/app-nav/app-nav'
import { createClient } from '@/lib/supabase/server'

// Authoritative server-side gate. The proxy is optimistic (can be bypassed if the
// matcher misses); this re-checks on the server for every protected render.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  return (
    <>
      <AppNav />
      {/* Mobile has no bar — only a floating hamburger — so reserve top space here to
          clear it (incl. pages with top-right actions). Desktop's sticky bar already
          occupies that space, so no extra padding there. */}
      <div className="pt-14 md:pt-0">{children}</div>
    </>
  )
}
