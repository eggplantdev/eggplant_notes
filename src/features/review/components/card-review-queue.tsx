'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import { CaughtUpNotice } from '@/features/review/components/caught-up-notice'
import { QueueAdvanceProvider } from '@/features/review/components/queue-advance-context'

// Wraps the server-rendered ReviewPanel (passed as children so its async markdown stays an RSC) and
// turns the single-card page into a due-queue walk: after a non-celebrating rating, RatingButtons
// calls advance() with the soonest-due remaining card — we navigate there, or swap to the caught-up
// notice in place when the queue is empty. A goal-crossing rating never calls advance (it stays put
// to show the celebration), so we never navigate out from under an open dialog.
export function CardReviewQueue({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [caughtUp, setCaughtUp] = useState(false)

  const advance = (nextDueId: string | undefined) =>
    nextDueId ? router.push(`/memory-cards/${nextDueId}`) : setCaughtUp(true)

  return (
    <QueueAdvanceProvider advance={advance}>
      {caughtUp ? <CaughtUpNotice /> : children}
    </QueueAdvanceProvider>
  )
}
