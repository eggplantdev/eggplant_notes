import type { SupabaseClient } from '@supabase/supabase-js'

import type { DueCardT, TopicCheckT } from '@/features/topic-checks/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// The due-review queue for /review: the single soonest-due check plus the total due count, in
// one round-trip. RLS scopes rows to the owner. The `(user_id, due_at)` btree index backs the
// `due_at <= now()` filter + ordering. `count: 'exact'` returns the full match count alongside
// the `limit(1)` row, so the page renders one card without over-fetching the whole backlog.
// As of S-03 the review write path sets a future `due_at` via FSRS; a freshly-created check
// defaults `due_at` to now() so it is due immediately until its first review reschedules it.
// Does NOT use runTableQuery: that wrapper returns rows and throws on null data, whereas here
// we need both the row and the count off the same response — so it's hand-rolled. Embeds
// notes(title) (typed via the topic_checks→notes FK) so the card can link to its source note
// by title (S-08) without a second round-trip.
export async function getDueQueue(
  client?: SupabaseClient<Database>,
): Promise<{ first?: DueCardT; count: number }> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  const { data, count, error } = await supabase
    .from('topic_checks')
    .select('*, notes(title)', { count: 'exact' })
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(1)
  if (error) {
    console.error('[getDueQueue] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return { first: data?.[0], count: count ?? 0 }
}

// Lean read backing the dashboard stats: every owned check, but only the columns the
// aggregation needs. RLS scopes rows to the owner. Returns the full set so counts/buckets are
// computed in TS — PostgREST can't group by the APP_TIME_ZONE-shifted due date in a plain
// select (same constraint as getReviewActivity). Personal-scale data, so fetching all rows is
// fine. Injectable client per the isolation rule.
export async function getChecksForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('topic_checks').select('id, prompt, note_id, state, due_at, stability, lapses'),
  )
}

// Returns all topic checks attached to one note, oldest first (FR-015). RLS scopes rows to the
// owner, so a note the caller doesn't own yields []. Injectable client (defaults to the server
// client) so Playwright can call it with a signInWithPassword client per the isolation test.
export async function getTopicChecksForNote(
  noteId: string,
  client?: SupabaseClient<Database>,
): Promise<TopicCheckT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('topic_checks')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true }),
  )
}
