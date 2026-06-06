'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import confetti from 'canvas-confetti'

import { GoalCelebrationDialog } from '@/features/review/goal-celebration-dialog'
import type { GoalCelebrationT } from '@/features/review/types'

type CelebrationContextT = { celebrate: (payload: GoalCelebrationT) => void }

const ReviewCelebrationContext = createContext<CelebrationContextT | undefined>(undefined)

// Holds celebration state ABOVE the panel's `card ? ... : empty` branch so the dialog survives
// RatingButtons unmounting when the last due card is rated — exactly when the goal is most often crossed.
export function ReviewCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<GoalCelebrationT | undefined>(undefined)

  const celebrate = useCallback((payload: GoalCelebrationT) => {
    void confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    setCelebration(payload)
  }, [])

  const value = useMemo(() => ({ celebrate }), [celebrate])

  return (
    <ReviewCelebrationContext value={value}>
      {children}
      <GoalCelebrationDialog celebration={celebration} onClose={() => setCelebration(undefined)} />
    </ReviewCelebrationContext>
  )
}

export function useReviewCelebration(): CelebrationContextT {
  const ctx = useContext(ReviewCelebrationContext)
  if (!ctx) throw new Error('useReviewCelebration must be used within ReviewCelebrationProvider')
  return ctx
}
