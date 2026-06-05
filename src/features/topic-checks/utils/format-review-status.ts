import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY, todayInZone } from '@/lib/utils/date'

// FSRS state codes stored in topic_checks.state (smallint). `as const` map, not an enum
// (project rule). New/Learning aren't meaningfully "due", so they surface the state directly.
const STATE_LABEL = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' } as const

// UTC-midnight Date of an instant as seen in APP_TIME_ZONE — same encoding todayInZone uses, so
// the two are directly comparable for a whole-day diff regardless of the server's UTC clock.
function zoneMidnight(date: Date): Date {
  return new Date(`${isoDateInZone(date, APP_TIME_ZONE)}T00:00:00.000Z`)
}

// Short human label for a check's review status on the /topic-checks card. New/Learning show the
// state label; scheduled cards (Review/Relearning) show calendar-relative due text in
// APP_TIME_ZONE: a past day → "Overdue", today → "Due today", else "Due in Nd".
export function formatReviewStatus(input: { state: number; due_at: string }): string {
  if (input.state === 0 || input.state === 1) return STATE_LABEL[input.state]
  const days = Math.round(
    (zoneMidnight(new Date(input.due_at)).getTime() - todayInZone(APP_TIME_ZONE).getTime()) /
      MS_PER_DAY,
  )
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}
