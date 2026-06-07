import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppNav } from '@/components/app-nav/app-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { getCurrentUser } from '@/lib/supabase/server'

// Authoritative server-side gate — the proxy is only optimistic (matcher can miss), so this
// re-checks on every protected render.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/sign-in')

  return (
    <>
      <AppNav />
      {/* Mobile has only a floating hamburger, so reserve top space to clear it; desktop's sticky
          bar already occupies that space, so no padding there. */}
      <div className="pt-14 md:pt-0">{children}</div>
      <SiteFooter />
    </>
  )
}
