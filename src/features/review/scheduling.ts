import { type Card, fsrs, type Grade, type State } from 'ts-fsrs'

import { GRADES } from '@/features/review/grades'
import type { TopicCheckT } from '@/features/topic-checks/types'

// Single home for all ts-fsrs interaction: the algorithm choice is swappable here and the
// row<->Card serialization seam (Postgres ISO strings <-> Date) lives in one place, unit-tested.
// A single shared scheduler instance (default FSRS parameters) avoids re-init per call.
const scheduler = fsrs()

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
function toCard(row: TopicCheckT): Card {
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

// The predicted next due date for each grade, for the Anki-style button previews. Keyed by the
// four grade numbers (1=Again .. 4=Easy); `number` rather than the Rating enum keeps ts-fsrs
// types out of consumers (the page/island index with plain 1..4).
export function previewIntervals(row: TopicCheckT, now: Date): Record<number, Date> {
  const preview = scheduler.repeat(toCard(row), now)
  return Object.fromEntries(GRADES.map(({ grade }) => [grade, preview[grade as Grade].card.due]))
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
