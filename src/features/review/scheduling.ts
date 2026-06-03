import { type Card, fsrs, type Grade, Rating, type State } from 'ts-fsrs'

import type { TopicCheckT } from '@/features/topic-checks/types'

// Single home for all ts-fsrs interaction: the algorithm choice is swappable here and the
// row<->Card serialization seam (Postgres ISO strings <-> Date) lives in one place, unit-tested.
// A single shared scheduler instance (default FSRS parameters) avoids re-init per call.
const scheduler = fsrs()

// The four user-facing grades in ascending order. Rating also has Manual(0), which we never
// use; these map 1:1 to the rating buttons and the review_events 1..4 check.
export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const

// The shape record_review's `p_card` jsonb expects: Dates emitted as ISO strings.
export type SerializedCardT = {
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  due: string
  last_review: string | null
}

// Build a ts-fsrs Card from a topic_checks row. Postgres returns timestamps as ISO strings;
// ts-fsrs wants Dates — convert on this edge (and back in serializeCard).
export function toCard(row: TopicCheckT): Card {
  return {
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

// The predicted next due date for each grade, for the Anki-style button previews.
export function previewIntervals(row: TopicCheckT, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(toCard(row), now)
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  }
}

// Apply the chosen grade -> the next Card state to persist. `rating` is the validated 1..4
// number from the action boundary; cast to Grade keeps ts-fsrs types isolated to this module.
export function applyRating(row: TopicCheckT, rating: number, now: Date): Card {
  return scheduler.next(toCard(row), now, rating as Grade).card
}

// Serialize a Card to the jsonb shape record_review unpacks (Dates -> ISO strings).
export function serializeCard(card: Card): SerializedCardT {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}
