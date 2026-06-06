import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

export type ReviewedAtRowT = { reviewed_at: string }

// Review EVENTS on or after `weekStartStr` (YYYY-MM-DD in APP_TIME_ZONE). Counts events, NOT distinct
// cards (a card reviewed twice counts twice). Rows before weekStartStr are ignored, letting the query
// over-fetch an 8-day buffer to dodge UTC-vs-Warsaw skew.
export function countReviewsInWeek(rows: ReviewedAtRowT[], weekStartStr: string): number {
  return rows.filter((r) => isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStartStr)
    .length
}
