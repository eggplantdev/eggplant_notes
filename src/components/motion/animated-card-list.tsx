'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { AnimatedListItem } from '@/components/motion/animated-list-item'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  // Optional description, stacked under the title in the SAME left content column — so it sits
  // beside the action slot (gap-x-4 away), not below it. This is for prose that belongs with the
  // title (a subject's blurb), NOT for tags/chips — those go full width below via renderSubtitle.
  renderDescription?: (item: T) => ReactNode
  // Optional overline above the title (e.g. a date), spanning the card's full width so it sits
  // clear of the action slot. Caller owns its markup. Omitted → no overline row.
  renderEyebrow?: (item: T) => ReactNode
  // Optional secondary line, pinned to the BOTTOM of the card (mt-auto) so it lines up across a
  // row even when titles differ in length — in a grid where cards stretch to equal height. The
  // caller owns its markup so each list styles it differently (a subject chip, a date, a clamped
  // description). In the non-grid stack (subjects) cards are content-height, so there's no spare
  // space to push into — it simply renders as the last block.
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
  renderDescription,
  renderEyebrow,
  renderSubtitle,
  renderAction,
  gridLayout = false,
}: PropsT<T>) {
  // Re-fade the whole list when the URL query changes (search / subject filter / page), so a page
  // swap reads as a clean content transition on the freshly-loaded data — instead of the inner
  // per-item popLayout FLIP trying to reshuffle an entirely new key-set (which finishes before the
  // new page is in and looks janky). `initial={false}` keeps the FIRST render quiet under
  // PageShell's own mount fade; only navigations (navKey change) animate. Within a page — add /
  // delete with no URL change — navKey is stable, so the inner FLIP still does its job.
  const navKey = useSearchParams().toString()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={navKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={cn('gap-3', gridLayout ? 'grid md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => {
            const key = getKey(item)
            return (
              <AnimatedListItem key={key} layoutId={key} layout>
                <Link href={getHref(item)} className={cn(gridLayout && 'block h-full')}>
                  <Card
                    className={cn('hover:border-ring transition-colors', gridLayout && 'h-full')}
                  >
                    {/* gap-x-4: keep the title/eyebrow column clear of the action slot (gap-1 alone
                        let Edit/Delete crowd the title); row gap stays tight via the base gap-1. */}
                    <CardHeader className="gap-x-4">
                      {renderEyebrow?.(item)}
                      <CardTitle>{renderTitle(item)}</CardTitle>
                      {renderDescription && (
                        <CardDescription>{renderDescription(item)}</CardDescription>
                      )}
                      {renderAction && (
                        // CardAction is the grid's top-right slot. blockCardNav sits on this parent
                        // (bubble phase) so each action's own handler fires first — consumers must
                        // not re-add preventDefault/stopPropagation.
                        <CardAction onClick={blockCardNav}>{renderAction(item)}</CardAction>
                      )}
                    </CardHeader>
                    {/* Subtitle pinned to the bottom (mt-auto) so tags align across a grid row. */}
                    {renderSubtitle && (
                      <CardContent className="mt-auto">{renderSubtitle(item)}</CardContent>
                    )}
                  </Card>
                </Link>
              </AnimatedListItem>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
