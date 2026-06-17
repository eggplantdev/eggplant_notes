'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

import { ALL_NAV_ITEMS } from '@/components/app-nav/nav-items'
import { useFadeSlideUp } from '@/components/motion/fade-slide-up'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type WidthT = 'full' | 'prose' | 'wide'

type PropsT = {
  title: string
  eyebrow?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  backHref?: string
  backLabel?: string
  // Navigate browser history (router.back) instead of backHref; falls back to backHref/'/' on a deep link with no history.
  backHistory?: boolean
  // Inner width within the container-shell cap: 'full' fills it, 'prose' = max-w-2xl, 'wide' = max-w-4xl.
  width?: WidthT
  children: ReactNode
}

const WIDTH_CLASS: Record<WidthT, string> = {
  full: '',
  prose: 'mx-auto w-full max-w-2xl',
  wide: 'mx-auto w-full max-w-4xl',
}

// Shared layout wrapper for every protected page; the mount fade+slide honors prefers-reduced-motion → opacity-only.
export function PageShell({
  title,
  eyebrow,
  subtitle,
  actions,
  backHref,
  backLabel,
  backHistory,
  width = 'full',
  children,
}: PropsT) {
  const pathname = usePathname()
  const router = useRouter()
  // Hides the mobile <h1> only on nav-root routes (CurrentPageLabel pins those). Exact match,
  // not isNavActive: detail/new/edit pages live under a nav route but their title is unique content.
  const isNavRoot = ALL_NAV_ITEMS.some((item) => item.href === pathname)

  return (
    <main className="container-shell overflow-x-clip py-6 md:py-12">
      <motion.div
        {...useFadeSlideUp({ y: 20, transition: { duration: 0.4, ease: 'easeInOut' } })}
        className={cn('flex flex-col gap-6', WIDTH_CLASS[width])}
      >
        {(backHref || backHistory) && (
          <div>
            {backHistory ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  window.history.length > 1 ? router.back() : router.push(backHref ?? '/')
                }
              >
                ← {backLabel}
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href={backHref!}>← {backLabel}</Link>
              </Button>
            )}
          </div>
        )}

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            {eyebrow}
            <h1 className={cn('text-2xl font-semibold', isNavRoot && 'hidden md:block')}>
              {title}
            </h1>
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        {children}
      </motion.div>
    </main>
  )
}
