import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatFullDate,
  formatLocaleDate,
  formatLocaleDateTime,
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

// Regression guard for the /notes hydration error (React #418): these helpers must render
// identical text no matter the runtime timezone, because SSR (UTC) and the browser (the
// user's zone) format the SAME value and any divergence is a hydration mismatch. The Date
// constructor reads process.env.TZ, so flipping it between two extreme zones and asserting
// equal output fails the instant the APP_TIME_ZONE pin is dropped.
describe('formatLocaleDate / formatLocaleDateTime are timezone-stable', () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  // A late-UTC instant lands on a different calendar day depending on the zone, so an
  // unpinned formatter would print 6/10 in Los Angeles and 6/11 in Tokyo.
  const lateUtc = '2026-06-10T23:30:00.000Z'

  it('formatLocaleDate ignores the ambient zone', () => {
    process.env.TZ = 'America/Los_Angeles'
    const la = formatLocaleDate(lateUtc)
    process.env.TZ = 'Asia/Tokyo'
    const tokyo = formatLocaleDate(lateUtc)
    expect(la).toBe(tokyo)
    expect(la).toBe('6/11/2026') // Europe/Warsaw (UTC+2) calendar day
  })

  it('formatLocaleDateTime ignores the ambient zone', () => {
    process.env.TZ = 'America/Los_Angeles'
    const la = formatLocaleDateTime(lateUtc)
    process.env.TZ = 'Asia/Tokyo'
    const tokyo = formatLocaleDateTime(lateUtc)
    expect(la).toBe(tokyo)
  })
})
