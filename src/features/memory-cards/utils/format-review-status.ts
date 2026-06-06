import { FSRS_STATE_LABELS } from '@/features/memory-cards/constants'
import { APP_TIME_ZONE, MS_PER_DAY, todayInZone, zoneMidnight } from '@/lib/utils/date'

// New/Learning show the state label; scheduled cards show calendar-relative due text in
// APP_TIME_ZONE. Both operands snap to zone-midnight, so the diff is a whole-day count (DST-safe).
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
