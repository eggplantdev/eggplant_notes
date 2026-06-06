'use client'

import { usePathname } from 'next/navigation'

import { isNavActive } from './is-nav-active'
import { ALL_NAV_ITEMS } from './nav-items'

// Mobile-only: names the current section since mobile has no nav bar to show the active route.
export function CurrentPageLabel() {
  const pathname = usePathname()
  const current = ALL_NAV_ITEMS.find((item) => isNavActive(pathname, item.href))
  if (!current) return null

  return (
    <span className="fixed top-4 left-4 z-50 flex h-8 items-center text-sm font-semibold md:hidden">
      {current.label}
    </span>
  )
}
