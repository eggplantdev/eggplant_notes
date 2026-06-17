'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

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

// When the whole card is a <Link>, this stops a click in the action slot from navigating. It must
// sit on a PARENT of the action (bubble phase) so each action's own handler fires first and to dodge
// the Radix-trigger-child preventDefault trap a per-button handler hits — so consumers must NOT
// re-add it. Harmless (no-op) when getHref is omitted and there's no surrounding Link.
function blockCardNav(e: MouseEvent<HTMLDivElement>) {
  e.preventDefault()
  e.stopPropagation()
}

type PropsT<T> = {
  items: T[]
  getKey: (item: T) => string
  // When omitted, the card is NOT wrapped in a <Link> — the whole card stops being a navigation
  // target (memory cards review in place via an explicit Review button instead of a card-body link).
  getHref?: (item: T) => string
  renderTitle: (item: T) => ReactNode
  // Sits beside the action slot in the title column (prose that belongs with the title); use renderSubtitle for full-width tags/chips.
  renderDescription?: (item: T) => ReactNode
  renderEyebrow?: (item: T) => ReactNode
  // Pinned to the card bottom (mt-auto) so it lines up across a grid row of unequal-height cards.
  renderSubtitle?: (item: T) => ReactNode
  renderAction?: (item: T) => ReactNode
  // Per-item classes merged onto the Card (e.g. an overdue card's red glow). twMerge-resolved, so it
  // can override the base hover:border-ring.
  getItemClassName?: (item: T) => string | undefined
  // Default is a vertical stack; gridLayout switches to a responsive card grid (1/2/3 cols).
  gridLayout?: boolean
}

// Client component because callers pass render functions, which can't cross the RSC boundary —
// so per-feature wrappers (e.g. NotesList) must also be 'use client'.
export function AnimatedCardList<T>({
  items,
  getKey,
  getHref,
  renderTitle,
  renderDescription,
  renderEyebrow,
  renderSubtitle,
  renderAction,
  getItemClassName,
  gridLayout = false,
}: PropsT<T>) {
  // Keying the outer fade on the query string cross-fades whole-page swaps; otherwise the inner
  // popLayout FLIP tries to reshuffle an entirely new key-set and looks janky. Stable within a page
  // (add/delete with no URL change), so the inner FLIP still animates those.
  const navKey = useSearchParams().toString()
  const shouldReduceMotion = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={navKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
        className={cn('gap-3', gridLayout ? 'grid md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col')}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => {
            const key = getKey(item)
            const href = getHref?.(item)
            const card = (
              <Card
                className={cn(
                  'transition-colors',
                  href && 'hover:border-ring',
                  gridLayout && 'h-full',
                  getItemClassName?.(item),
                )}
              >
                {/* Single layout at every width: row 1 is the eyebrow (left) + action slot (right),
                    row 2 is the full-width title. gap-y-2 keeps the row spacing tight. row-span-1
                    keeps the action on row 1 only so the col-span-2 title takes the whole second row. */}
                <CardHeader className="gap-x-4 gap-y-2">
                  {renderEyebrow?.(item)}
                  <CardTitle className="col-span-2">{renderTitle(item)}</CardTitle>
                  {renderDescription && (
                    <CardDescription className="col-span-2">
                      {renderDescription(item)}
                    </CardDescription>
                  )}
                  {renderAction && (
                    <CardAction onClick={blockCardNav} className="row-span-1">
                      {renderAction(item)}
                    </CardAction>
                  )}
                </CardHeader>
                {renderSubtitle && (
                  <CardContent className="mt-auto">{renderSubtitle(item)}</CardContent>
                )}
              </Card>
            )
            return (
              <AnimatedListItem key={key} layoutId={key} layout>
                {href ? (
                  <Link href={href} className={cn(gridLayout && 'block h-full')}>
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </AnimatedListItem>
            )
          })}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
