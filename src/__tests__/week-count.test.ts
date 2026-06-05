import { describe, expect, it } from 'vitest'

import type { ReviewedAtRowT } from '@/features/review-events/week-count'
import { countReviewsInWeek } from '@/features/review-events/week-count'
import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

describe('countReviewsInWeek', () => {
  // Build a timestamp inside a target zone-date; noon avoids any DST/offset edge.
  const at = (dateStr: string, hour = 12): string =>
    new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString()
  const row = (dateStr: string, hour?: number): ReviewedAtRowT => ({
    reviewed_at: at(dateStr, hour),
  })

  const today = isoDateInZone(new Date(), APP_TIME_ZONE)
  const dayBefore = (dateStr: string, days: number) =>
    isoDateInZone(
      new Date(Date.parse(`${dateStr}T00:00:00.000Z`) - days * 86_400_000),
      APP_TIME_ZONE,
    )

  it('counts EVENTS, not distinct cards (same instant-day twice counts twice)', () => {
    expect(countReviewsInWeek([row(today, 9), row(today, 18)], today)).toBe(2)
  })

  it('includes rows on the week-start boundary (>= is inclusive)', () => {
    const weekStart = dayBefore(today, 6)
    expect(countReviewsInWeek([row(weekStart), row(today)], weekStart)).toBe(2)
  })

  it('excludes rows before the week start', () => {
    const weekStart = dayBefore(today, 6)
    const tooOld = dayBefore(today, 7)
    expect(countReviewsInWeek([row(tooOld), row(today)], weekStart)).toBe(1)
  })

  it('is 0 when nothing falls in the window', () => {
    expect(countReviewsInWeek([], today)).toBe(0)
  })
})
