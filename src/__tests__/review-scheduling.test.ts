import { describe, expect, it } from 'vitest'

import type { TopicCheckT } from '@/features/topic-checks/types'
import { applyRating, previewIntervals } from '@/features/review/scheduling'

// FSRS Rating: Again=1, Hard=2, Good=3, Easy=4.
const AGAIN = 1
const GOOD = 3

// A fresh "New" card row: FSRS empty-card defaults (state=0, all counters 0), due now.
function freshRow(now: Date): TopicCheckT {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000002',
    note_id: '00000000-0000-0000-0000-000000000003',
    prompt: 'What is a closure?',
    example: null,
    code_context: null,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    due_at: now.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}

describe('applyRating', () => {
  const now = new Date('2026-06-03T12:00:00.000Z')

  it('rated Good advances a New card: future due, reps++, state advanced', () => {
    const card = applyRating(freshRow(now), GOOD, now)
    expect(card.due.getTime()).toBeGreaterThan(now.getTime())
    expect(card.reps).toBe(1)
    expect(card.state).toBeGreaterThan(0)
    expect(card.last_review?.getTime()).toBe(now.getTime())
  })

  it('rated Again schedules sooner than rated Good', () => {
    const again = applyRating(freshRow(now), AGAIN, now)
    const good = applyRating(freshRow(now), GOOD, now)
    expect(again.due.getTime()).toBeLessThan(good.due.getTime())
  })
})

describe('previewIntervals', () => {
  const now = new Date('2026-06-03T12:00:00.000Z')

  it('returns four distinct future dates ordered Again <= Hard <= Good <= Easy', () => {
    const preview = previewIntervals(freshRow(now), now)
    const [again, hard, good, easy] = [preview[1], preview[2], preview[3], preview[4]]

    for (const due of [again, hard, good, easy]) {
      expect(due.getTime()).toBeGreaterThan(now.getTime())
    }
    expect(again.getTime()).toBeLessThanOrEqual(hard.getTime())
    expect(hard.getTime()).toBeLessThanOrEqual(good.getTime())
    expect(good.getTime()).toBeLessThanOrEqual(easy.getTime())
    // Endpoints are strictly distinct (Again is the soonest, Easy the furthest).
    expect(again.getTime()).toBeLessThan(easy.getTime())
  })
})
