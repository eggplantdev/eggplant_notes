import type { ReactNode } from 'react'

import { ReviewCelebrationProvider } from '@/features/review/components/review-celebration-context'

// The celebration provider lives here, ABOVE the [id] page, so a goal-hit dialog survives the
// queue walk: rating a card advances via router.push to /memory-cards/<nextId>, which re-renders
// the page but NOT this layout (same [id] segment) — so the open dialog isn't unmounted. The
// dashboard isn't under this layout; ReviewPanel self-provides there (it advances in place).
// lessons.md:141-145.
export default function MemoryCardReviewLayout({ children }: { children: ReactNode }) {
  return <ReviewCelebrationProvider>{children}</ReviewCelebrationProvider>
}
