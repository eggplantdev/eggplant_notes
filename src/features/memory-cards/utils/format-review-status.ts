import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, zoneMidnight } from '@/lib/utils/date'

// FSRS state codes stored in memory_cards.state (smallint). `as const` map, not an enum
// (project rule). New/Learning aren't meaningfully "due", so they surface the state directly.
const STATE_LABEL = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' } as const

// Short human label for a check's review status on the /memory-cards card. New/Learning show the
// state label; scheduled cards (Review/Relearning) show calendar-relative due text in
// APP_TIME_ZONE: a past day → "Overdue", today → "Due today", else "Due in Nd". Both operands are
// snapped to zone-midnight, so the diff is a whole-day count, DST-safe.
export function formatReviewStatus(input: { state: number; due_at: string }): string {
  if (input.state === 0 || input.state === 1) return STATE_LABEL[input.state]
  const days = Math.round(
    (zoneMidnight(new Date(input.due_at), APP_TIME_ZONE).getTime() -
      todayInZone(APP_TIME_ZONE).getTime()) /
      MS_PER_DAY,
  )
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}
