'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useFadeSlideUp } from '@/components/motion/fade-slide-up'
import { REVIEW_PANEL_ID } from '@/features/review/constants'

// Smooth-scrolls the panel to the VERTICAL CENTER of the viewport once a freshly-swapped card has
// actually mounted, EXCEPT on the first card. Because the parent uses <AnimatePresence mode="wait">,
// the new card mounts only AFTER the old one animates out — so this component's mount effect fires
// once the new content is in the DOM, not before the `?review` swap has loaded. `initialRef` carries
// the "is this the first card?" flag across remounts (each swap mounts a fresh instance).
function CenterPanelOnSwap({ initialRef }: { initialRef: RefObject<boolean> }) {
  useEffect(() => {
    // Reading/writing the ref in an effect (not during render) is the allowed pattern. First card →
    // don't yank the page; every later swap (Review click or post-rating advance) centers the card.
    if (initialRef.current) {
      initialRef.current = false
      return
    }
    document
      .getElementById(REVIEW_PANEL_ID)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [initialRef])
  return null
}

// Fades the in-place review panel up on every card swap, so selecting a card or advancing after a
// rating cross-fades instead of snapping. `cardKey` is the reviewed card's id — when it changes (a
// `?review` swap or post-rating advance re-renders the server panel), AnimatePresence exits the old
// card and slides the new one up, then centers it in the viewport. The panel content (server-rendered
// markdown) rides in as children.
export function ReviewCardTransition({
  cardKey,
  children,
}: {
  cardKey: string
  children: ReactNode
}) {
  const motionProps = useFadeSlideUp({ exitY: -8, transition: { duration: 0.2, ease: 'easeOut' } })
  const isInitial = useRef(true)
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={cardKey} {...motionProps}>
        <CenterPanelOnSwap initialRef={isInitial} />
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
