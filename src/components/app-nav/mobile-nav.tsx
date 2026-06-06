'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MenuIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SignOutButton } from '@/features/auth/components/sign-out-button'
import { isNavActive } from './is-nav-active'
import { ALL_NAV_ITEMS } from './nav-items'

// Open and close controls share these exact classes so they sit in one spot and read as a single toggle.
const TOGGLE_BUTTON_CLASS = 'fixed top-4 right-4 z-50 md:hidden'

export function MobileNav() {
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
        <nav className="flex flex-col gap-1 p-4 pt-16">
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
          <SignOutButton className="mt-2 w-full justify-start" />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
