'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'

import { AnimatedListItem } from '@/components/motion/animated-list-item'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

type PropsT<T> = {
  items: T[]
  getKey: (item: T) => string
  getHref: (item: T) => string
  renderTitle: (item: T) => ReactNode
  // Optional secondary line, rendered as-is under the title (the caller owns its markup so
  // each list can style it differently, e.g. a date vs a line-clamped description).
  renderSubtitle?: (item: T) => ReactNode
}

// The shared animated list-of-linked-cards scaffold. Owns the drift-prone chrome —
// popLayout AnimatePresence, the per-row layout/layoutId for FLIP reordering, and the
// hover card — so notes/subjects (and future lists) stay in lockstep. Client component:
// callers pass render functions, which is why the per-feature wrappers (NotesList,
// SubjectsList) are also 'use client' — functions can't cross the RSC boundary from a
// Server page. initial={false} keeps the first render quiet under PageShell's transition.
export function AnimatedCardList<T>({
  items,
  getKey,
  getHref,
  renderTitle,
  renderSubtitle,
}: PropsT<T>) {
  return (
    // TODO(e2e): list views changed shape — rows are now <div>/motion.div, no <ul>/<li>.
    // Re-run pnpm test:e2e (notes.spec / subjects.spec list views) and fix any stale
    // getByRole('listitem') / locator('li') locators against this DOM. Check next test run.
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => {
          const key = getKey(item)
          return (
            <AnimatedListItem key={key} layoutId={key} layout>
              <Link href={getHref(item)}>
                <Card className="hover:border-ring transition-colors">
                  <CardHeader>
                    <CardTitle>{renderTitle(item)}</CardTitle>
                    {renderSubtitle?.(item)}
                  </CardHeader>
                </Card>
              </Link>
            </AnimatedListItem>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
