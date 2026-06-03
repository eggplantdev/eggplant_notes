import type { SupabaseClient } from '@supabase/supabase-js'

import { APP_TIME_ZONE, MS_PER_DAY } from '@/features/dashboard/constants'
import type { ActivityDayT } from '@/features/dashboard/types'
import { isoDateInZone, toISODate, todayInZone } from '@/features/dashboard/utils'
import type { ReviewEventT } from '@/features/review-events/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

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
// UTC). PostgREST can't group by a timezone-shifted date in a plain select, and per-user
// review volumes are small for the MVP, so we fetch the timestamps (RLS scopes them to the
// owner) and bucket in TS. Injectable client per the isolation rule (Playwright passes a
// signInWithPassword client). Shape reuses the dashboard-owned ActivityDayT.
export async function getReviewActivity(
  client?: SupabaseClient<Database>,
): Promise<ActivityDayT[]> {
  const supabase = client ?? (await createClient())
  const rows = await runTableQuery(supabase, (c) => c.from('review_events').select('reviewed_at'))

  const counts = new Map<string, number>()
  for (const { reviewed_at } of rows) {
    const day = isoDateInZone(new Date(reviewed_at), APP_TIME_ZONE)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return [...counts].map(([date, count]) => ({ date, count }))
}

// Consecutive days ending today (in APP_TIME_ZONE) with ≥1 review. Pure + synchronous —
// derived from the already-fetched getReviewActivity() series, so the dashboard composes
// both stats from a single activity read (no second DB query).
export function getCurrentStreak(activity: ActivityDayT[]): number {
  const active = new Set(activity.filter((a) => a.count > 0).map((a) => a.date))
  let streak = 0
  let cursorMs = todayInZone(APP_TIME_ZONE).getTime()
  while (active.has(toISODate(cursorMs))) {
    streak += 1
    cursorMs -= MS_PER_DAY
  }
  return streak
}
