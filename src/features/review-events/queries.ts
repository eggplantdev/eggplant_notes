import type { SupabaseClient } from '@supabase/supabase-js'

import {
  reviewedTodayCount,
  reviewsThisWeekCount,
  reviewWindowKeys,
} from '@/features/review-events/derive-counts'
import type { ReviewDayCountT, ReviewEventT } from '@/features/review-events/types'
import { runRpc } from '@/lib/supabase/run-rpc'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/create-server-client'
import type { Database } from '@/lib/supabase/types'
import { APP_TIME_ZONE, MS_PER_DAY } from '@/lib/utils'

// RLS scopes rows to the owner, so a known memory_card_id can't read another user's events.
export async function getReviewEvents(
  memoryCardId: string,
  client?: SupabaseClient<Database>,
): Promise<ReviewEventT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('review_events')
      .select('*')
      .eq('memory_card_id', memoryCardId)
      .order('reviewed_at', { ascending: false }),
  )
}

// Per-local-day review tallies (distinct cards + total events), bucketed in APP_TIME_ZONE by the
// review_day_counts RPC — so a multi-year history returns ~one row per day, not one per event, and
// needs no time window. `since` bounds the scan for the hot rate path (today + trailing week only);
// the dashboard omits it for the full-history streak.
export async function getReviewDayCounts(
  client?: SupabaseClient<Database>,
  since?: Date,
): Promise<ReviewDayCountT[]> {
  const supabase = client ?? (await createClient())
  const data = await runRpc('getReviewDayCounts', () =>
    supabase.rpc('review_day_counts', {
      p_time_zone: APP_TIME_ZONE,
      p_since: since?.toISOString(),
    }),
  )
  return (data ?? []).map((r) => ({
    date: r.day,
    distinctCards: r.distinct_cards,
    totalEvents: r.total_events,
  }))
}

// Today's distinct-card count + the trailing-week event total, for the goal-crossing check in
// rateMemoryCard. One windowed RPC call feeds both — the 8-day `since` just needs to cover today +
// the trailing week (the day-bucketing is done in APP_TIME_ZONE server-side, so there's no skew to
// buffer against). Replaces the old pair of buffered fetch-all reads.
export async function getReviewCounts(
  client?: SupabaseClient<Database>,
): Promise<{ today: number; week: number }> {
  const since = new Date(Date.now() - 8 * MS_PER_DAY)
  const rows = await getReviewDayCounts(client, since)
  const { todayStr, weekStartStr } = reviewWindowKeys()
  return {
    today: reviewedTodayCount(rows, todayStr),
    week: reviewsThisWeekCount(rows, weekStartStr),
  }
}
