import { formatInterval } from '@/features/review/format-interval'
import { previewIntervals } from '@/features/review/scheduling'
import type { MemoryCardT } from '@/features/memory-cards/types'

// `now` is threaded through so previewIntervals and formatInterval anchor to one instant.
export function buildPreviews(card: MemoryCardT | undefined, now: Date): Record<number, string> {
  if (!card) return {}
  return Object.fromEntries(
    Object.entries(previewIntervals(card, now)).map(([grade, due]) => [
      grade,
      formatInterval(now, due),
    ]),
  )
}
