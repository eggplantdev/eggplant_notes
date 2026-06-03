import { describe, expect, it } from 'vitest'

import { getCurrentStreak } from '@/features/review-events/streak'
import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, toISODate } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Build an activity date N days before today, using the same helpers getCurrentStreak
// compares against so the keys match exactly regardless of when the suite runs.
const todayMs = todayInZone(APP_TIME_ZONE).getTime()
const dayAgo = (n: number): string => toISODate(todayMs - n * MS_PER_DAY)
const days = (...offsets: number[]): ActivityDayT[] =>
  offsets.map((n) => ({ date: dayAgo(n), count: 1 }))

describe('getCurrentStreak', () => {
  it('returns 0 for no activity', () => {
    expect(getCurrentStreak([])).toBe(0)
  })

  it('counts a run ending today', () => {
    expect(getCurrentStreak(days(0, 1, 2))).toBe(3)
  })

  it('returns 1 when only today is active', () => {
    expect(getCurrentStreak(days(0))).toBe(1)
  })

  it('applies the grace day: un-reviewed today does not zero a live streak', () => {
    // No entry for today; yesterday + 2-days-ago form the run → streak ends yesterday.
    expect(getCurrentStreak(days(1, 2))).toBe(2)
  })

  it('ends the streak on any gap earlier than the grace day', () => {
    // Today + yesterday active, but 2-days-ago missing → streak stops at yesterday.
    expect(getCurrentStreak(days(0, 1, 3, 4))).toBe(2)
  })

  it('returns 0 when both today and yesterday are missing', () => {
    expect(getCurrentStreak(days(2, 3))).toBe(0)
  })

  it('ignores days with a zero count', () => {
    const activity: ActivityDayT[] = [
      { date: dayAgo(0), count: 0 },
      { date: dayAgo(1), count: 1 },
    ]
    // Today present but count 0 (inactive) → grace shifts to yesterday, which is active.
    expect(getCurrentStreak(activity)).toBe(1)
  })
})
