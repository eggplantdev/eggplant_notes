'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Lets RatingButtons (rendered deep inside a server-rendered ReviewPanel that's passed to
// CardReviewQueue as children) ask the queue to advance, without the server page having to pass a
// function down. `advance()` navigates to the next due card the queue already knows (computed at
// page render, prefetched), or shows caught-up when there is none. Absent on the dashboard (no
// provider) — there the hook returns undefined and RatingButtons keeps its in-place revalidate behavior.
type AdvanceFnT = () => void

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
