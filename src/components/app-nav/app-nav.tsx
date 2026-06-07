import { Suspense } from 'react'

import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { NavConnectButton } from '@/features/openrouter/components/nav-connect-button'
import { NavCredits } from '@/features/openrouter/components/nav-credits'
import { isOpenRouterConnected } from '@/features/openrouter/queries'
import { CurrentPageLabel } from './current-page-label'
import { MobileNav } from './mobile-nav'
import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items'
import { NavLink } from './nav-link'

// Mobile has no bar chrome at all — just MobileNav's floating hamburger; the bar held nothing else there.
export async function AppNav() {
  const connected = await isOpenRouterConnected()
  return (
    <>
      <header className="bg-background sticky top-0 z-40 hidden border-b md:block">
        <div className="container-shell flex items-center justify-between gap-2 py-4">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {connected ? (
              <Suspense fallback={null}>
                <NavCredits />
              </Suspense>
            ) : (
              <NavConnectButton />
            )}
            <NavLink href={SETTINGS_ITEM.href} label={SETTINGS_ITEM.label} />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <CurrentPageLabel />
      <MobileNav
        connected={connected}
        credits={
          connected ? (
            <Suspense fallback={null}>
              <NavCredits className="mt-2 w-full justify-start" />
            </Suspense>
          ) : null
        }
      />
    </>
  )
}
