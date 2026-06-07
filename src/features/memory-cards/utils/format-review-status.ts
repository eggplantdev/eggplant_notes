import { FSRS_STATE_LABELS } from '@/features/memory-cards/constants'
import { APP_TIME_ZONE, daysUntilDue } from '@/lib/utils/date'

// New/Learning show the state label; scheduled cards show calendar-relative due text in
// APP_TIME_ZONE (whole-day, DST-safe — see daysUntilDue).
export function formatReviewStatus(input: { state: number; due_at: string }): string {
  if (input.state === 0 || input.state === 1) return FSRS_STATE_LABELS[input.state]
  const days = daysUntilDue(input.due_at, APP_TIME_ZONE)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}
