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
      {/* Single page <main> for every protected route — owns the container width + the mobile top
          offset (pt-18) that clears the floating hamburger; desktop's sticky bar reserves its own
          space, so md:py-6. Lives here, not in PageShell, so it's present even on pages that skip it. */}
      <main className="container-shell overflow-x-clip pt-18 pb-12 md:py-6">{children}</main>
      <SiteFooter />
    </>
  )
}
