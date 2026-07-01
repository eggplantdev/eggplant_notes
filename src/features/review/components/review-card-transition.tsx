'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useFadeSlideUp } from '@/components/motion/fade-slide-up'
import { REVIEW_PANEL_ID } from '@/features/review/constants'

// Smooth-scrolls the panel to the VERTICAL CENTER of the viewport once a freshly-swapped card has
// actually mounted, EXCEPT on a plain first load. Because the parent uses <AnimatePresence mode="wait">,
// the new card mounts only AFTER the old one animates out — so this component's mount effect fires
// once the new content is in the DOM, not before the `?review` swap has loaded. `initialRef` carries
// the "is this the first card?" flag across remounts (each swap mounts a fresh instance).
// `scrollOnMount` overrides the first-load skip for a deep-link arrival (dashboard → ?review=<id>):
// we scroll explicitly instead of via the URL hash, because native #anchor scrolling is unreliable in
// an installed PWA / standalone display mode and silently no-ops there.
function CenterPanelOnSwap({
  initialRef,
  scrollOnMount,
}: {
  initialRef: RefObject<boolean>
  scrollOnMount: boolean
}) {
  useEffect(() => {
    // Reading/writing the ref in an effect (not during render) is the allowed pattern. Plain first
    // load → don't yank the page; a deep-link arrival (scrollOnMount) and every later swap center it.
    if (initialRef.current) {
      initialRef.current = false
      if (!scrollOnMount) return
    }
    document
      .getElementById(REVIEW_PANEL_ID)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [initialRef, scrollOnMount])
  return null
}

// Fades the in-place review panel up on every card swap, so selecting a card or advancing after a
// rating cross-fades instead of snapping. `cardKey` is the reviewed card's id — when it changes (a
// `?review` swap or post-rating advance re-renders the server panel), AnimatePresence exits the old
// card and slides the new one up, then centers it in the viewport. The panel content (server-rendered
// markdown) rides in as children.
export function ReviewCardTransition({
  cardKey,
  scrollOnMount = false,
  children,
}: {
  cardKey: string
  // The page loaded already deep-linked to a specific card (?review=<id>) — center it on first mount.
  scrollOnMount?: boolean
  children: ReactNode
}) {
  const motionProps = useFadeSlideUp({ exitY: -8, transition: { duration: 0.2, ease: 'easeOut' } })
  const isInitial = useRef(true)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={cardKey} {...motionProps}>
        <CenterPanelOnSwap initialRef={isInitial} scrollOnMount={scrollOnMount} />
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
