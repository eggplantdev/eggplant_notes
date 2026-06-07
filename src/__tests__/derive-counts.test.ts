import { describe, expect, it } from 'vitest'

import {
  reviewedTodayCount,
  reviewsThisWeekCount,
  toActivity,
} from '@/features/review-events/derive-counts'
import type { ReviewDayCountT } from '@/features/review-events/types'

// These helpers slice the already-bucketed review_day_counts RPC rows. The per-day dedup (distinct
// cards) and APP_TIME_ZONE bucketing now happen in SQL, so they're covered at the integration layer
// (see test-plan §3 risk #2), not here — here we only assert the pure slicing/summing.

const day = (date: string, distinctCards: number, totalEvents: number): ReviewDayCountT => ({
  date,
  distinctCards,
  totalEvents,
})

describe('reviewedTodayCount', () => {
  const rows = [day('2026-06-05', 3, 4), day('2026-06-07', 5, 9)]

  it("returns today's distinct-card count", () => {
    expect(reviewedTodayCount(rows, '2026-06-07')).toBe(5)
  })

  it('is 0 when today has no row', () => {
    expect(reviewedTodayCount(rows, '2026-06-06')).toBe(0)
  })
})

describe('reviewsThisWeekCount', () => {
  const rows = [day('2026-06-01', 2, 2), day('2026-06-05', 3, 4), day('2026-06-07', 5, 9)]

  it('sums total events on/after the week start (events, not distinct cards)', () => {
    expect(reviewsThisWeekCount(rows, '2026-06-05')).toBe(13)
  })

  it('includes the boundary day and excludes earlier days', () => {
    expect(reviewsThisWeekCount(rows, '2026-06-01')).toBe(15)
    expect(reviewsThisWeekCount(rows, '2026-06-08')).toBe(0)
  })
})

describe('toActivity', () => {
  it('maps day rows to {date, count} using distinct cards', () => {
    expect(toActivity([day('2026-06-07', 5, 9)])).toEqual([{ date: '2026-06-07', count: 5 }])
  })
})
