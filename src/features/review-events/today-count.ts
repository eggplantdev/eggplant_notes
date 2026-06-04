import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

export type ReviewedRowT = { topic_check_id: string; reviewed_at: string }

// Count distinct cards reviewed on a given calendar day (a YYYY-MM-DD in APP_TIME_ZONE), from
// an over-fetched row set. Pure + client-free so it's unit-testable apart from the Supabase
// query (mirrors review-events/streak.ts). Dedupes by topic_check_id — the same card reviewed
// twice in a day counts once; rows whose zone-bucketed date isn't `dateStr` are ignored, which
// is what lets the query over-fetch a 2-day buffer to dodge the UTC-vs-Warsaw midnight skew.
export function countDistinctReviewedOn(rows: ReviewedRowT[], dateStr: string): number {
  const cards = new Set<string>()
  for (const { topic_check_id, reviewed_at } of rows) {
    if (isoDateInZone(new Date(reviewed_at), APP_TIME_ZONE) === dateStr) cards.add(topic_check_id)
  }
  return cards.size
}
