'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Lets RatingButtons (rendered deep inside a server-rendered ReviewPanel that's passed to
// CardReviewQueue as children) ask the queue to advance, without the server page having to pass a
// function down. `advance(nextDueId)` navigates to the next due card, or shows caught-up when
// undefined. Absent on the dashboard (no provider) — there the hook returns undefined and
// RatingButtons keeps its in-place revalidate behavior.
type AdvanceFnT = (nextDueId: string | undefined) => void

const QueueAdvanceContext = createContext<AdvanceFnT | undefined>(undefined)

export function QueueAdvanceProvider({
  advance,
  children,
}: {
  advance: AdvanceFnT
  children: ReactNode
}) {
  return <QueueAdvanceContext value={advance}>{children}</QueueAdvanceContext>
}

export function useQueueAdvance(): AdvanceFnT | undefined {
  return useContext(QueueAdvanceContext)
}
