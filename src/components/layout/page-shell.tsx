'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

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
  // Inner content width. 'full' = edge-to-edge (default; dashboard); 'prose' = max-w-2xl
  // (read-heavy pages); 'wide' = max-w-4xl (the note editor).
  width?: WidthT
  // Hide the <h1> on mobile. Only set on top-level nav pages, where CurrentPageLabel already
  // shows the section name — leave it off on detail/new/edit pages whose title is unique
  // content (e.g. a note's own title) that nothing else surfaces on mobile.
  hideTitleOnMobile?: boolean
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
  width = 'full',
  hideTitleOnMobile = false,
  children,
}: PropsT) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <main className="p-4 sm:p-6">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' }}
        className={cn('flex flex-col gap-6', WIDTH_CLASS[width])}
      >
        {backHref && (
          <div>
            <Button asChild variant="ghost" size="sm">
              <Link href={backHref}>← {backLabel}</Link>
            </Button>
          </div>
        )}

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className={cn('text-2xl font-semibold', hideTitleOnMobile && 'hidden md:block')}>
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
