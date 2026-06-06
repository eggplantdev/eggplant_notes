import { FSRS_STATE_LABELS } from '@/features/memory-cards/constants'
import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, zoneMidnight } from '@/lib/utils/date'

// Short human label for a card's review status on the /memory-cards card. New/Learning show the
// state label; scheduled cards (Review/Relearning) show calendar-relative due text in
// APP_TIME_ZONE: a past day → "Overdue", today → "Due today", else "Due in Nd". Both operands are
// snapped to zone-midnight, so the diff is a whole-day count, DST-safe.
export function formatReviewStatus(input: { state: number; due_at: string }): string {
  if (input.state === 0 || input.state === 1) return FSRS_STATE_LABELS[input.state]
  const days = Math.round(
    (zoneMidnight(new Date(input.due_at), APP_TIME_ZONE).getTime() -
      todayInZone(APP_TIME_ZONE).getTime()) /
      MS_PER_DAY,
  )
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}
