import type { SupabaseClient } from '@supabase/supabase-js'

import { countDistinctReviewedOn } from '@/features/review-events/today-count'
import type { ReviewEventT } from '@/features/review-events/types'
import { countReviewsInWeek } from '@/features/review-events/week-count'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { APP_TIME_ZONE, isoDateInZone, MS_PER_DAY } from '@/lib/utils'
import type { ActivityDayT } from '@/types/activity'

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

// Per-day DISTINCT-card counts (bucketed in APP_TIME_ZONE, not UTC) so re-reviewing one card N
// times can't inflate a day — the same unit the goal bar and streak use. PostgREST can't group by
// a timezone-shifted date, so we fetch and bucket in TS. Bounded to ~400 days (371d heatmap window
// + streak slack) so it can't grow unbounded as history accumulates.
export async function getReviewActivity(
  client?: SupabaseClient<Database>,
): Promise<ActivityDayT[]> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 400 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('memory_card_id, reviewed_at').gte('reviewed_at', since),
  )

  const cardsByDay = new Map<string, Set<string>>()
  for (const { memory_card_id, reviewed_at } of rows) {
    const day = isoDateInZone(new Date(reviewed_at), APP_TIME_ZONE)
    const cards = cardsByDay.get(day) ?? new Set<string>()
    cards.add(memory_card_id)
    cardsByDay.set(day, cards)
  }
  return [...cardsByDay].map(([date, cards]) => ({ date, count: cards.size }))
}

// Distinct cards reviewed today (APP_TIME_ZONE). Over-fetches a ~2-day buffer instead of
// `>= utcMidnight`: APP_TIME_ZONE is UTC+1/+2, so a late-evening review sits just before UTC
// midnight and a naive UTC cutoff would drop it from "today"; we keep only rows bucketed to today.
export async function getReviewedTodayCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 2 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('memory_card_id, reviewed_at').gte('reviewed_at', since),
  )
  return countDistinctReviewedOn(rows, isoDateInZone(new Date(), APP_TIME_ZONE))
}

// Total review events in the trailing 7 days (today − 6d, zone-bucketed). Over-fetches an 8-day
// buffer to dodge the UTC-vs-Warsaw midnight skew; tally lives in pure countReviewsInWeek.
export async function getReviewsThisWeekCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - 8 * MS_PER_DAY).toISOString()
  const rows = await runTableQuery(supabase, (c) =>
    c.from('review_events').select('reviewed_at').gte('reviewed_at', since),
  )
  const weekStart = isoDateInZone(new Date(Date.now() - 6 * MS_PER_DAY), APP_TIME_ZONE)
  return countReviewsInWeek(rows, weekStart)
}

// Separate from getReviewActivity, which drops the rating. `windowDays` is a required arg (not a
// constant) so this feature doesn't import dashboard constants.
export async function getRecentRatings(windowDays: number, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  const since = new Date(Date.now() - windowDays * MS_PER_DAY).toISOString()
  return runTableQuery(supabase, (c) =>
    c.from('review_events').select('rating, reviewed_at').gte('reviewed_at', since),
  )
}
