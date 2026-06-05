import { describe, expect, it } from 'vitest'

import { formatReviewStatus } from '@/features/memory-cards/utils'
import { APP_TIME_ZONE, MS_PER_DAY, todayInZone } from '@/lib/utils/date'

// An ISO timestamp at noon (Warsaw) of the zone-date `dayOffset` days from today. Noon avoids
// DST/offset edges so the zone-midnight day diff the helper computes is exactly `dayOffset`.
const dueAtDaysFromToday = (dayOffset: number): string =>
  new Date(
    todayInZone(APP_TIME_ZONE).getTime() + dayOffset * MS_PER_DAY + MS_PER_DAY / 2,
  ).toISOString()

describe('formatReviewStatus', () => {
  it('shows the state label for New (0) and Learning (1), ignoring due_at', () => {
    // due_at deliberately far in the past — New/Learning short-circuit before any date math.
    expect(formatReviewStatus({ state: 0, due_at: dueAtDaysFromToday(-10) })).toBe('New')
    expect(formatReviewStatus({ state: 1, due_at: dueAtDaysFromToday(-10) })).toBe('Learning')
  })

  it('labels a scheduled card due before today as Overdue', () => {
    expect(formatReviewStatus({ state: 2, due_at: dueAtDaysFromToday(-1) })).toBe('Overdue')
    expect(formatReviewStatus({ state: 3, due_at: dueAtDaysFromToday(-5) })).toBe('Overdue')
  })

  it('labels a scheduled card due today as Due today', () => {
    expect(formatReviewStatus({ state: 2, due_at: dueAtDaysFromToday(0) })).toBe('Due today')
  })

  it('labels a scheduled card due in N days as "Due in Nd"', () => {
    expect(formatReviewStatus({ state: 2, due_at: dueAtDaysFromToday(1) })).toBe('Due in 1d')
    expect(formatReviewStatus({ state: 2, due_at: dueAtDaysFromToday(7) })).toBe('Due in 7d')
  })
})
