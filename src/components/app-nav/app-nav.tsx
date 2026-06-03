import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { CurrentPageLabel } from './current-page-label'
import { MobileNav } from './mobile-nav'
import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items'
import { NavLink } from './nav-link'

// Protected-shell navigation. Server-rendered; only the NavLink and MobileNav leaf
// islands carry 'use client'. Desktop (md+): a full-bleed sticky top bar. Mobile: no bar
// chrome at all — just a fixed floating hamburger (MobileNav), since the bar held nothing
// else there.
export function AppNav() {
  return (
    <>
      <header className="bg-background sticky top-0 z-40 hidden border-b md:block">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 p-4">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <NavLink href={SETTINGS_ITEM.href} label={SETTINGS_ITEM.label} />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <CurrentPageLabel />
      <MobileNav />
    </>
  )
}
