import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isCardOverdue } from '@/features/memory-cards/utils'
import { APP_TIME_ZONE, daysUntilDue } from '@/lib/utils/date'

// R2 (test-plan §2 / Risk Response #2): the timezone + day-boundary correctness of the recall loop's
// calendar math — the edge `format-review-status.test.ts` deliberately skips ("Noon avoids DST/offset
// edges"). The DUE-SET predicate itself (`due_at <= now()`) is an instant comparison with no timezone
// logic, so it is NOT tested here — testing it would assert Postgres's `<=`. The real day-boundary
// logic lives in `daysUntilDue` (Europe/Warsaw, DST-safe via zone-midnight snap + Math.round); a bug
// there shows a card as "Due today" when it is really due tomorrow, or miscounts "Overdue".
//
// Oracle = the calendar, not the code: the whole-day count between two instants is the difference of
// their Europe/Warsaw CALENDAR dates, and stays exact across a DST transition (a 23h spring-forward
// day and a 25h fall-back day each still count as one day). "Now" is pinned with fake timers so
// "today in zone" is deterministic; ICU (Intl) is unaffected by fake timers, so the zone math is real.
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const setNow = (iso: string) => vi.setSystemTime(new Date(iso))

describe('daysUntilDue — timezone day boundary (R2)', () => {
  beforeEach(() => {
    // Noon UTC on 2026-01-15 → 13:00 Warsaw (winter, UTC+1). "Today" in Warsaw is 2026-01-15.
    setNow('2026-01-15T12:00:00Z')
  })

  it('buckets a due instant by its WARSAW calendar date, not the UTC date (off-by-one guard)', () => {
    // 23:30Z on Jan 15 is already 00:30 on Jan 16 in Warsaw → due tomorrow (1), NOT today.
    const justAfterWarsawMidnight = '2026-01-15T23:30:00Z'
    expect(daysUntilDue(justAfterWarsawMidnight, APP_TIME_ZONE)).toBe(1)
    // Same instant read in UTC stays on Jan 15 → 0. The zone is what moves the day — proving the
    // assertion above isn't a tautology (a UTC-based implementation would return 0 here too).
    expect(daysUntilDue(justAfterWarsawMidnight, 'UTC')).toBe(0)
  })

  it('returns 0 for a card due later today (Warsaw)', () => {
    // 22:30Z → 23:30 Warsaw, still Jan 15.
    expect(daysUntilDue('2026-01-15T22:30:00Z', APP_TIME_ZONE)).toBe(0)
  })

  it('returns a negative count for a card due on an earlier Warsaw day', () => {
    expect(daysUntilDue('2026-01-14T12:00:00Z', APP_TIME_ZONE)).toBe(-1)
  })
})

describe('daysUntilDue — DST transitions stay whole days (R2)', () => {
  it('counts whole days across the spring-forward 23h day (2026-03-29)', () => {
    // Today = Sat 2026-03-28 (Warsaw, pre-DST UTC+1). Clocks jump 02:00→03:00 on Sun the 29th.
    setNow('2026-03-28T12:00:00Z')
    // Mon the 30th is two calendar days ahead — must be 2 even though the 29th was only 23h long.
    expect(daysUntilDue('2026-03-30T10:00:00Z', APP_TIME_ZONE)).toBe(2)
    // Sun the 29th itself is one calendar day ahead.
    expect(daysUntilDue('2026-03-29T10:00:00Z', APP_TIME_ZONE)).toBe(1)
  })

  it('counts whole days across the fall-back 25h day (2026-10-25)', () => {
    // Today = Sat 2026-10-24 (Warsaw, pre-fallback UTC+2). Clocks fall 03:00→02:00 on Sun the 25th.
    setNow('2026-10-24T10:00:00Z')
    // Mon the 26th is two calendar days ahead — must be 2 even though the 25th was 25h long.
    expect(daysUntilDue('2026-10-26T11:00:00Z', APP_TIME_ZONE)).toBe(2)
  })
})

describe('isCardOverdue — boundary + state guard (R2)', () => {
  beforeEach(() => {
    setNow('2026-01-15T12:00:00Z') // today = 2026-01-15 in Warsaw
  })

  it('flips at the Warsaw midnight boundary for a scheduled card', () => {
    // 22:59:59Z = Jan 14 23:59:59 Warsaw → an earlier day → overdue.
    expect(isCardOverdue({ state: 2, due_at: '2026-01-14T22:59:59Z' })).toBe(true)
    // One second later, 23:00:00Z = Jan 15 00:00 Warsaw → today → NOT overdue (due-today ≠ overdue).
    expect(isCardOverdue({ state: 2, due_at: '2026-01-14T23:00:00Z' })).toBe(false)
  })

  it('never marks a New (0) or Learning (1) card overdue, however old its due_at', () => {
    // State guard wins over the date — these cards aren't on the schedule yet.
    expect(isCardOverdue({ state: 0, due_at: '2020-01-01T00:00:00Z' })).toBe(false)
    expect(isCardOverdue({ state: 1, due_at: '2020-01-01T00:00:00Z' })).toBe(false)
  })
})
