import type { SupabaseClient } from '@supabase/supabase-js'

import type { TopicCheckT } from '@/features/topic-checks/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// Returns the owner's topic checks that are due (RLS scopes rows to the owner).
//
// NOTE (F3): `due_at` defaults to now() at insert and NOTHING writes the SM-2
// scheduling columns until S-03 (close-recall-loop). So every row's `due_at` is its
// creation time — already in the past relative to this query — and this helper returns
// ALL of the user's topic checks by design until the SM-2 write path lands. That is
// expected, not a bug. The `due_at <= now()` filter + the `(user_id, due_at)` index are
// in place now so the query is correct the moment scheduling starts writing future dates.
export async function getTopicChecksDue(client?: SupabaseClient<Database>): Promise<TopicCheckT[]> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  return runTableQuery(supabase, (c) =>
    c.from('topic_checks').select('*').lte('due_at', now).order('due_at', { ascending: true }),
  )
}
