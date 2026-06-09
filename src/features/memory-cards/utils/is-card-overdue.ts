import { APP_TIME_ZONE, daysUntilDue } from '@/lib/utils/date'

// True only for a scheduled (state 2/3) card whose due date is before today in APP_TIME_ZONE.
// New/Learning (state 0/1) are never overdue — they aren't on the review schedule yet. Mirrors
// formatReviewStatus's 'Overdue' branch as a predicate so visual treatment doesn't depend on the
// display string.
export function isCardOverdue(input: { state: number; due_at: string }): boolean {
  if (input.state === 0 || input.state === 1) return false
  return daysUntilDue(input.due_at, APP_TIME_ZONE) < 0
}
