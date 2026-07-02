'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import confetti from 'canvas-confetti'

type CelebrationContextT = { celebrate: () => void }

const ReviewCelebrationContext = createContext<CelebrationContextT | undefined>(undefined)

// Lives ABOVE the panel's `card ? ... : empty` branch so a goal crossed on the last due card
// still fires confetti after RatingButtons unmounts.
export function ReviewCelebrationProvider({ children }: { children: ReactNode }) {
  const celebrate = useCallback(() => {
    void confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
  }, [])

  const value = useMemo(() => ({ celebrate }), [celebrate])

  return <ReviewCelebrationContext value={value}>{children}</ReviewCelebrationContext>
}

export function useReviewCelebration(): CelebrationContextT {
  const ctx = useContext(ReviewCelebrationContext)
  if (!ctx) throw new Error('useReviewCelebration must be used within ReviewCelebrationProvider')
  return ctx
}
