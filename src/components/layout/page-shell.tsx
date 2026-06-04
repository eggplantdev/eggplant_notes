'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { ALL_NAV_ITEMS } from '@/components/app-nav/nav-items'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type WidthT = 'full' | 'prose' | 'wide'

type PropsT = {
  title: string
  // Optional secondary line under the title (e.g. "Updated …", an email, a description).
  subtitle?: ReactNode
  // Trailing controls on the title row (e.g. a "New note" button, "N due", edit/delete).
  actions?: ReactNode
  // Optional back link rendered above the header, visible on every breakpoint.
  backHref?: string
  backLabel?: string
  // When true, the back control navigates browser history (router.back()) instead of linking to
  // backHref — so it returns to wherever the user came from. Falls back to backHref (or '/') when
  // there's no history to go back to (e.g. a directly-opened deep link).
  backHistory?: boolean
  // Inner content width, within the shared `container-shell` cap (max-w 120rem) the <main>
  // already applies. 'full' = fill that cap (default; dashboard); 'prose' = max-w-2xl
  // (read-heavy pages); 'wide' = max-w-4xl (the note editor).
  width?: WidthT
  children: ReactNode
}

const WIDTH_CLASS: Record<WidthT, string> = {
  full: '',
  prose: 'mx-auto w-full max-w-2xl',
  wide: 'mx-auto w-full max-w-4xl',
}

// The single layout wrapper for every protected page: standardized padding, top-aligned
// content, a consistent title/subtitle/actions header, an optional back link, and a
// page-transition fade+slide on mount (honors prefers-reduced-motion → opacity-only).
// Replaces the per-page hand-rolled <main> wrappers that had drifted on padding, gap, width,
// and vertical alignment (settings was vertically centered). Server pages stay Server
// Components and pass their content as children — only this shell crosses the client boundary.
export function PageShell({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
  backHistory,
  width = 'full',
  children,
}: PropsT) {
  const shouldReduceMotion = useReducedMotion()
  const pathname = usePathname()
  const router = useRouter()
  // Hide the <h1> on mobile only on the top-level nav routes, where CurrentPageLabel already
  // pins the section name. Derived from the nav registry (exact href match) rather than a
  // per-page prop, so it stays in lockstep with CurrentPageLabel and can't drift. Exact match
  // (not isNavActive) is deliberate: detail/new/edit pages live *under* a nav route but their
  // title is unique content (a note's own name), so they must keep the <h1> on mobile.
  const isNavRoot = ALL_NAV_ITEMS.some((item) => item.href === pathname)

  return (
    <main className="container-shell py-4 sm:py-6">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' }}
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
