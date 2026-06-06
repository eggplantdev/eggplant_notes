import { formatInterval } from '@/features/review/format-interval'
import { previewIntervals } from '@/features/review/scheduling'
import type { MemoryCardT } from '@/features/memory-cards/types'

// Map each grade's predicted next due date to a human-readable interval label for the rating
// buttons. Total over a missing card (nothing due) → empty map, so callers don't branch. `now`
// is threaded in (not read here) so previewIntervals and formatInterval anchor to one instant.
export function buildPreviews(card: MemoryCardT | undefined, now: Date): Record<number, string> {
  if (!card) return {}
  return Object.fromEntries(
    Object.entries(previewIntervals(card, now)).map(([grade, due]) => [
      grade,
      formatInterval(now, due),
    ]),
  )
}
