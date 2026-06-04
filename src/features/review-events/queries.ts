import type { SupabaseClient } from '@supabase/supabase-js'

import { countDistinctReviewedOn } from '@/features/review-events/today-count'
import type { ReviewEventT } from '@/features/review-events/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

// Review history for one topic check, newest first. RLS scopes rows to the owner, so a
// caller can never read another user's review events even with a known topic_check_id.
export async function getReviewEvents(
  topicCheckId: string,
  client?: SupabaseClient<Database>,
): Promise<ReviewEventT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('review_events')
      .select('*')
      .eq('topic_check_id', topicCheckId)
      .order('reviewed_at', { ascending: false }),
  )
}

// Per-day review counts for the dashboard activity heatmap, bucketed in APP_TIME_ZONE (not
// UTC). PostgREST can't group by a timezone-shifted date in a plain select, so we fetch the
// timestamps (RLS scopes them to the owner) and bucket in TS. The read is bounded to the last
// ~400 days — the 53-week heatmap window (371d) plus streak slack — so it can't grow unbounded
// as all-time history accumulates. Injectable client per the isolation rule (Playwright passes
// a signInWithPassword client). Shape reuses the shared ActivityDayT.
export async function getReviewActivity(
  client?: SupabaseClient<Database>,
): Promise<ActivityDayT[]> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 400 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('reviewed_at').gte('reviewed_at', since),
  )

  const counts = new Map<string, number>()
  for (const { reviewed_at } of rows) {
    const day = isoDateInZone(new Date(reviewed_at), APP_TIME_ZONE)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts].map(([date, count]) => ({ date, count }))
}

// Distinct cards reviewed *today* (in APP_TIME_ZONE), for the dashboard daily-goal bar. We
// fetch a ~2-day buffer rather than `>= utcMidnight`: APP_TIME_ZONE is UTC+1/+2, so a review
// late in the local evening can sit just before UTC midnight — a naive UTC-midnight cutoff
// would drop it from "today." We over-fetch, then keep only rows whose zone-bucketed date is
// today, and count distinct topic_check_id (the same card reviewed twice counts once).
// Injectable client per the isolation rule.
export async function getReviewedTodayCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 2 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('topic_check_id, reviewed_at').gte('reviewed_at', since),
  )
  return countDistinctReviewedOn(rows, isoDateInZone(new Date(), APP_TIME_ZONE))
}

// Total review events in the trailing 7 days (today − 6d, zone-bucketed) — the same window the
// dashboard's weekly goal bar uses (stats.ts reviewsThisWeek). Counts EVENTS, not distinct cards
// (a card reviewed twice counts twice), matching that bar. Over-fetches an 8-day buffer to dodge
// the UTC-vs-Warsaw midnight skew, then filters by zone date. Injectable client per the isolation
// rule. RLS scopes rows to the owner.
export async function getReviewsThisWeekCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 8 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('reviewed_at').gte('reviewed_at', since),
  )
  const weekStart = isoDateInZone(new Date(Date.now() - 6 * MS_PER_DAY), APP_TIME_ZONE)
  return rows.filter((r) => isoDateInZone(new Date(r.reviewed_at), APP_TIME_ZONE) >= weekStart)
    .length
}

// Rating + timestamp of every review in the trailing `windowDays`, backing the dashboard's
// retention / lapse-rate / review-volume stats (the heatmap's getReviewActivity drops the
// rating, so this is a separate read). The window is the caller's policy (the dashboard owns
// it) — kept a required arg so this feature doesn't import dashboard constants. Aggregation
// happens in TS. RLS scopes rows to the owner; injectable client per the rule.
export async function getRecentRatings(windowDays: number, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()
  return runTableQuery(supabase, (c) =>
    c.from('review_events').select('rating, reviewed_at').gte('reviewed_at', since),
  )
}
