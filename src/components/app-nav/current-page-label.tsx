'use client'

import { usePathname } from 'next/navigation'

import { isNavActive } from './is-nav-active'
import { ALL_NAV_ITEMS } from './nav-items'

// Mobile has no nav bar (only a floating hamburger), so the active route is otherwise
// invisible once the page scrolls. This mirrors the hamburger on the opposite corner and
// names the current section. Desktop conveys the same via the bar's active highlight.
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
