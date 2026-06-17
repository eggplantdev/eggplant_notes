import { Suspense } from 'react'

import { BrandMark } from '@/components/brand/brand-mark'
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
      <header className="from-background pointer-events-none sticky top-0 z-40 hidden bg-gradient-to-b from-40% to-transparent pb-12 md:block">
        <div className="container-shell pointer-events-auto flex items-center justify-between gap-2 py-4">
          <div className="flex items-center gap-1">
            <BrandMark
              href="/dashboard"
              aria-label="eggplant_notes — dashboard"
              className="focus-ring rounded-md"
              wordmarkClassName="hidden"
            />
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>

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

      {/* Mobile-only gradient backing the fixed brand/label/hamburger (which sit at z-50) — mirrors the desktop header fade. */}
      <div className="from-background pointer-events-none fixed inset-x-0 top-0 z-40 h-24 bg-gradient-to-b from-40% to-transparent md:hidden" />

      {/* Mobile-only fixed brand, mirroring the floating hamburger on the right — the logo is the dashboard link. */}
      <BrandMark
        href="/dashboard"
        aria-label="eggplant_notes — dashboard"
        className="focus-ring fixed top-4 left-4 z-50 flex size-8 items-center justify-center rounded-md md:hidden"
        wordmarkClassName="hidden"
      />
      <CurrentPageLabel />
      <MobileNav
        connected={connected}
        credits={
          connected ? (
            <Suspense fallback={null}>
              <NavCredits className="w-full justify-start" />
            </Suspense>
          ) : null
        }
      />
    </>
  )
}
