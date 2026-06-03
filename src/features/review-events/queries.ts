import type { SupabaseClient } from '@supabase/supabase-js'

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
