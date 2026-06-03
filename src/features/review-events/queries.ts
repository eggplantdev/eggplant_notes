import type { SupabaseClient } from '@supabase/supabase-js'

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
