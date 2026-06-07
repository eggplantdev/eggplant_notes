import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatFullDate,
  isoDateInZone,
  MS_PER_DAY,
  toISODate,
  todayInZone,
  utcMidnight,
  zoneMidnight,
} from '@/lib/utils/date'

// Oracle here is the real calendar, NOT the source comments: date.ts:58 claims
// "Wed, Jun 3, 2025" but 2025-06-03 is a Tuesday, so the expected values are verified
// against ICU, not copied from the implementation's docstring.
//
// formatLocaleDate / formatLocaleDateTime are deliberately NOT tested: they are thin
// toLocale* wrappers whose output depends on the runtime default locale (e.g. "6/3/2025"
// vs "03.06.2025"), so any exact assertion would pin the platform, not a behaviour.

const WARSAW = 'Europe/Warsaw'

describe('MS_PER_DAY', () => {
  it('is one day of milliseconds', () => {
    expect(MS_PER_DAY).toBe(86_400_000)
  })
})

describe('utcMidnight', () => {
  it('strips time-of-day to the UTC calendar day', () => {
    const ms = utcMidnight(new Date('2025-06-03T15:30:45.123Z'))
    expect(new Date(ms).toISOString()).toBe('2025-06-03T00:00:00.000Z')
  })

  it('buckets any instant on the same UTC date to one value', () => {
    expect(utcMidnight(new Date('2025-06-03T00:00:01Z'))).toBe(
      utcMidnight(new Date('2025-06-03T23:59:59Z')),
    )
  })
})

describe('toISODate', () => {
  it('renders the UTC calendar date of an epoch-ms value', () => {
    expect(toISODate(Date.UTC(2025, 5, 3))).toBe('2025-06-03')
  })

  it('handles the unix epoch', () => {
    expect(toISODate(0)).toBe('1970-01-01')
  })
})

describe('isoDateInZone — buckets an instant by the user zone, not UTC', () => {
  it('keeps a morning-UTC instant on the same day', () => {
    expect(isoDateInZone(new Date('2025-06-03T08:00:00Z'), WARSAW)).toBe('2025-06-03')
  })

  it('rolls a late-night UTC instant into the next zone day (summer, UTC+2)', () => {
    expect(isoDateInZone(new Date('2025-06-03T23:30:00Z'), WARSAW)).toBe('2025-06-04')
  })

  it('still rolls correctly across the winter DST offset (UTC+1)', () => {
    expect(isoDateInZone(new Date('2025-01-15T23:30:00Z'), WARSAW)).toBe('2025-01-16')
  })
})

describe('zoneMidnight', () => {
  it('returns the UTC-anchored midnight of the zone calendar date', () => {
    const m = zoneMidnight(new Date('2025-06-03T23:30:00Z'), WARSAW)
    expect(m.toISOString()).toBe('2025-06-04T00:00:00.000Z')
  })
})

describe('todayInZone', () => {
  afterEach(() => vi.useRealTimers())

  it('follows the user zone past the UTC day boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-03T23:30:00Z')) // 01:30 next day in Warsaw
    expect(todayInZone(WARSAW).toISOString()).toBe('2025-06-04T00:00:00.000Z')
  })

  it('always lands on a UTC midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-03T08:00:00Z'))
    const today = todayInZone(WARSAW)
    expect([today.getUTCHours(), today.getUTCMinutes(), today.getUTCSeconds()]).toEqual([0, 0, 0])
  })
})

describe('formatFullDate', () => {
  it('renders the verified weekday/month/day/year, UTC-anchored', () => {
    // 2025-06-03 is a TUESDAY — the date.ts comment saying "Wed" is wrong.
    expect(formatFullDate('2025-06-03')).toBe('Tue, Jun 3, 2025')
  })
})
