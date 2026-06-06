import { APP_TIME_ZONE, isoDateInZone } from '@/lib/utils'

export type ReviewedRowT = { memory_card_id: string; reviewed_at: string }

// Distinct cards reviewed on `dateStr` (YYYY-MM-DD in APP_TIME_ZONE). Dedupes by memory_card_id;
// rows bucketed to another date are ignored, which lets the query over-fetch a 2-day buffer to dodge UTC-vs-Warsaw skew.
export function countDistinctReviewedOn(rows: ReviewedRowT[], dateStr: string): number {
  const cards = new Set<string>()
  for (const { memory_card_id, reviewed_at } of rows) {
    if (isoDateInZone(new Date(reviewed_at), APP_TIME_ZONE) === dateStr) cards.add(memory_card_id)
  }
  return cards.size
}
