import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

export type ReviewedAtRowT = { reviewed_at: string }

// Count review EVENTS on or after a week-start date (a YYYY-MM-DD in APP_TIME_ZONE), from an
// over-fetched row set. Counts events, NOT distinct cards (a card reviewed twice counts twice) —
// matches the dashboard weekly bar (stats.ts reviewsThisWeek). Pure + client-free so it's
// unit-testable apart from the Supabase query (mirrors today-count.ts countDistinctReviewedOn);
// rows whose zone-bucketed date is before weekStartStr are ignored, which lets the query
// over-fetch an 8-day buffer to dodge the UTC-vs-Warsaw midnight skew.
export function countReviewsInWeek(rows: ReviewedAtRowT[], weekStartStr: string): number {
  return rows.filter((r) => isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStartStr)
    .length
}
