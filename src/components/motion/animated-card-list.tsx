'use client'

import Link from 'next/link'
import { type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'

import { AnimatedListItem } from '@/components/motion/animated-list-item'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// The whole card is a <Link>, so a click inside the action slot would navigate. This wrapper
// neutralizes that ONCE for every consumer: preventDefault kills the native anchor activation,
// stopPropagation keeps the click off Next's Link onClick. It sits on a PARENT of the action
// (bubble phase), so each action's own handler (a router.push, a Radix dialog trigger) fires
// first — and being a parent it dodges the Radix-trigger-child preventDefault trap a per-button
// handler would hit. Consumers therefore must NOT re-add preventDefault/stopPropagation.
function blockCardNav(e: MouseEvent<HTMLDivElement>) {
  e.preventDefault()
  e.stopPropagation()
}

type PropsT<T> = {
  items: T[]
  getKey: (item: T) => string
  getHref: (item: T) => string
  renderTitle: (item: T) => ReactNode
  // Optional overline above the title (e.g. a date), spanning the card's full width so it sits
  // clear of the action slot. Caller owns its markup. Omitted → no overline row.
  renderEyebrow?: (item: T) => ReactNode
  // Optional secondary line, rendered as-is under the title (the caller owns its markup so
  // each list can style it differently, e.g. a date vs a line-clamped description).
  renderSubtitle?: (item: T) => ReactNode
  // Optional top-right action, rendered as a sibling of the title inside the card. The slot
  // wraps it in a nav-neutralizing container (see blockCardNav), so the action just renders its
  // controls — no need to preventDefault/stopPropagation itself. Omitted → card DOM unchanged.
  renderAction?: (item: T) => ReactNode
  // Container arrangement. Default: a single vertical stack (subjects). Opt into `gridLayout`
  // for a responsive card grid (1 col on mobile, 2 from md, 3 from xl) — used by the notes list.
  gridLayout?: boolean
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
  renderEyebrow,
  renderSubtitle,
  renderAction,
  gridLayout = false,
}: PropsT<T>) {
  return (
    <div
      className={cn('gap-3', gridLayout ? 'grid md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => {
          const key = getKey(item)
          return (
            <AnimatedListItem key={key} layoutId={key} layout>
              <Link href={getHref(item)} className={cn(gridLayout && 'block h-full')}>
                <Card className={cn('hover:border-ring transition-colors', gridLayout && 'h-full')}>
                  <CardHeader>
                    {renderEyebrow?.(item)}
                    {renderAction ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid gap-1.5">
                          <CardTitle>{renderTitle(item)}</CardTitle>
                          {renderSubtitle?.(item)}
                        </div>
                        <div className="shrink-0" onClick={blockCardNav}>
                          {renderAction(item)}
                        </div>
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
