import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { AppNav } from '@/components/app-nav/app-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { getCurrentUser } from '@/lib/supabase/get-current-user'

// Authoritative server-side gate — the proxy is only optimistic (matcher can miss), so this
// re-checks on every protected render.
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

  if (!user) redirect('/sign-in')

  return (
    <>
      <AppNav />
      {/* Single page <main> for every protected route — owns the container width + the mobile top
          offset (pt-18) that clears the floating hamburger. Desktop has no top padding: the sticky bar's
          gradient tail (pb-* on the header) is the spacing, so content fades under it. Lives here, not in
          PageShell, so it's present even on pages that skip it. */}
      <main className="container-shell overflow-x-clip pt-18 pb-12 md:pt-0 md:pb-6">
        {children}
      </main>
      <SiteFooter />
    </>
  )
}
