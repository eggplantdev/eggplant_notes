import { describe, expect, it } from 'vitest'

import { countDistinctReviewedOn } from '@/features/review-events/today-count'
import type { ReviewedRowT } from '@/features/review-events/today-count'
import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

describe('countDistinctReviewedOn', () => {
  // Build timestamps inside a target zone-date. Noon avoids any DST/offset edge, and two
  // distinct instants on the same day prove dedup is by card, not by timestamp.
  const today = isoDateInZone(new Date(), APP_TIME_ZONE)
  const at = (dateStr: string, hour = 12): string =>
    new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString()
  const row = (id: string, dateStr: string, hour?: number): ReviewedRowT => ({
    topic_check_id: id,
    reviewed_at: at(dateStr, hour),
  })

  it('counts distinct cards reviewed today', () => {
    expect(countDistinctReviewedOn([row('a', today), row('b', today)], today)).toBe(2)
  })

  it('dedupes the same card reviewed twice today (counts once)', () => {
    expect(countDistinctReviewedOn([row('a', today, 9), row('a', today, 18)], today)).toBe(1)
  })

  it('excludes a review from another day', () => {
    const yesterday = isoDateInZone(
      new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000),
      APP_TIME_ZONE,
    )
    expect(countDistinctReviewedOn([row('a', yesterday), row('b', today)], today)).toBe(1)
  })

  it('is 0 when nothing matches the day', () => {
    expect(countDistinctReviewedOn([], today)).toBe(0)
  })
})
