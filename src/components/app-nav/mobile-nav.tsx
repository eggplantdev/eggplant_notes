'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MenuIcon, XIcon } from 'lucide-react'

import { BrandMark } from '@/components/brand/brand-mark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { NavConnectButton } from '@/features/openrouter/components/nav-connect-button'
import { isNavActive } from './is-nav-active'
import { ALL_NAV_ITEMS } from './nav-items'

// Open and close controls share these exact classes so they sit in one spot and read as a single toggle.
const TOGGLE_BUTTON_CLASS =
  'fixed top-4 right-4 z-50 bg-black text-white hover:bg-black hover:text-white md:hidden'

export function MobileNav({
  connected,
  credits,
}: {
  connected: boolean
  // Rendered in AppNav (server) and passed down as a slot — NavCredits is an async server component
  // and can't be imported into this client component directly.
  credits?: ReactNode
}) {
  const pathname = usePathname()

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open menu"
          className={TOGGLE_BUTTON_CLASS}
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" showCloseButton={false} className="bg-background">
        {/* Required for the dialog's accessible name; hidden since the menu is self-evident. */}
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetClose asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Close menu"
            className={TOGGLE_BUTTON_CLASS}
          >
            <XIcon />
          </Button>
        </SheetClose>
        {/* Brand sits on the same row as the close button (top-4) — not styled as an interactive nav item. */}
        <SheetClose asChild>
          <BrandMark href="/dashboard" className="absolute top-4 left-4 h-7" />
        </SheetClose>
        <nav className="flex h-full flex-col gap-1 p-4 pt-16">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = isNavActive(pathname, item.href)
            return (
              <SheetClose asChild key={item.href}>
                <Button
                  asChild
                  variant={isActive ? 'secondary' : 'ghost'}
                  className="justify-start"
                >
                  <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </Button>
              </SheetClose>
            )
          })}
          {/* Balance/connect + sign-out pinned to the bottom of the sheet. */}
          <div className="mt-auto flex flex-col gap-2">
            {connected ? credits : <NavConnectButton className="w-full justify-start" />}
            <SignOutButton className="w-full justify-start" />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
