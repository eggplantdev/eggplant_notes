import { describe, expect, it } from 'vitest'

import { generateReviewHistory } from '@/features/sample-data/review-history'

const USER = 'user-123'
// A spread of card ids large enough to satisfy the "distinct cards/day >= goal" streak rule.
const CARD_IDS = Array.from({ length: 70 }, (_, i) => `card-${i}`)
// Fixed instant so the generated spread is deterministic.
const NOW = new Date('2026-06-10T09:00:00.000Z')

const DAY_MS = 24 * 60 * 60 * 1000
const startOfDay = (d: Date) => {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

describe('generateReviewHistory', () => {
  it('returns no events when there are no cards (an empty insert would error)', () => {
    expect(generateReviewHistory([], USER, NOW)).toEqual([])
  })

  it('produces history — the regression: the loader used to insert ZERO review_events', () => {
    const events = generateReviewHistory(CARD_IDS, USER, NOW)
    expect(events.length).toBeGreaterThan(100)
  })

  it('owns every event and points each at a real card with a valid rating', () => {
    const ids = new Set(CARD_IDS)
    for (const e of generateReviewHistory(CARD_IDS, USER, NOW)) {
      expect(e.user_id).toBe(USER)
      expect(ids.has(e.memory_card_id)).toBe(true)
      expect(e.rating).toBeGreaterThanOrEqual(0)
      expect(e.rating).toBeLessThanOrEqual(5)
    }
  })

  it('spreads events across roughly a year so the heatmap has depth', () => {
    const days = new Set(
      generateReviewHistory(CARD_IDS, USER, NOW).map((e) =>
        startOfDay(new Date(e.reviewed_at as string)).getTime(),
      ),
    )
    // Not every day has activity (rest days), but coverage must span most of the year.
    expect(days.size).toBeGreaterThan(200)
  })

  it('keeps a goal-hitting recent streak: >= 5 distinct cards on each of the last 7 days', () => {
    const today = startOfDay(NOW).getTime()
    const events = generateReviewHistory(CARD_IDS, USER, NOW)
    for (let back = 0; back < 7; back++) {
      const dayStart = today - back * DAY_MS
      const cardsThatDay = new Set(
        events
          .filter((e) => startOfDay(new Date(e.reviewed_at as string)).getTime() === dayStart)
          .map((e) => e.memory_card_id),
      )
      expect(cardsThatDay.size, `day -${back} should hit the daily goal`).toBeGreaterThanOrEqual(5)
    }
  })

  it('is deterministic for a fixed `now`', () => {
    expect(generateReviewHistory(CARD_IDS, USER, NOW)).toEqual(
      generateReviewHistory(CARD_IDS, USER, NOW),
    )
  })
})
