'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { CaughtUpNotice } from '@/features/review/components/caught-up-notice'
import { QueueAdvanceProvider } from '@/features/review/components/queue-advance-context'

// Wraps the server-rendered ReviewPanel (passed as children so its async markdown stays an RSC) and
// turns the single-card page into a due-queue walk. The soonest-due remaining card (`nextDueId`) is
// computed at page render, so on mount we PREFETCH its route — warming the next card's RSC (Shiki
// markup included) while the user reads/answers. After a rating, RatingButtons calls advance(): we
// push to that already-warm route (instant) or swap to the caught-up notice in place when the queue
// is empty. The celebration dialog lives in this route's LAYOUT provider, so it survives the
// navigation even when the goal is crossed mid-walk.
export function CardReviewQueue({
  nextDueId,
  children,
}: {
  nextDueId?: string
  children: ReactNode
}) {
  const router = useRouter()
  const [caughtUp, setCaughtUp] = useState(false)

  // Prefetch-on-mount is a genuine imperative side effect (warm the next route's RSC), not the
  // derived-state misuse the "avoid useEffect" rule targets — there's no render-time equivalent.
  useEffect(() => {
    if (nextDueId) router.prefetch(`/memory-cards/${nextDueId}`)
  }, [nextDueId, router])

  const advance = () => (nextDueId ? router.push(`/memory-cards/${nextDueId}`) : setCaughtUp(true))

  return (
    <QueueAdvanceProvider advance={advance}>
      {caughtUp ? <CaughtUpNotice /> : children}
    </QueueAdvanceProvider>
  )
}
