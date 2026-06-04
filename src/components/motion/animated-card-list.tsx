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
  // Optional top-right action, rendered as a sibling of the title inside the card. The whole
  // card is a <Link>, so an interactive action here must preventDefault/stopPropagation on its
  // own click (see SubjectCardNewNoteButton). Omitted → the card DOM is unchanged (notes list).
  renderAction?: (item: T) => ReactNode
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
  renderAction,
}: PropsT<T>) {
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => {
          const key = getKey(item)
          return (
            <AnimatedListItem key={key} layoutId={key} layout>
              <Link href={getHref(item)}>
                <Card className="hover:border-ring transition-colors">
                  <CardHeader>
                    {renderAction ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid gap-1.5">
                          <CardTitle>{renderTitle(item)}</CardTitle>
                          {renderSubtitle?.(item)}
                        </div>
                        {renderAction(item)}
                      </div>
                    ) : (
                      <>
                        <CardTitle>{renderTitle(item)}</CardTitle>
                        {renderSubtitle?.(item)}
                      </>
                    )}
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
