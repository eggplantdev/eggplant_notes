'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { isNavActive } from './is-nav-active'

type NavLinkPropsT = {
  href: string
  label: string
}

export function NavLink({ href, label }: NavLinkPropsT) {
  const pathname = usePathname()
  const isActive = isNavActive(pathname, href)

  return (
    <Button asChild variant={isActive ? 'secondary' : 'ghost'} size="sm">
      <Link href={href} aria-current={isActive ? 'page' : undefined}>
        {label}
      </Link>
    </Button>
  )
}
