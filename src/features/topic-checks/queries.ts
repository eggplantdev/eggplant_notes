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

// Count of the owner's topic checks that are due now — the dashboard "Due today" stat. Uses a
// head + exact-count select so no row payload is fetched, with the same `due_at <= now()`
// filter as getDueQueue. Injectable client per the isolation rule. Deliberately does NOT
// use runTableQuery: a head+count response has `data: null` on success, which runTableQuery
// treats as an error and throws — so the error envelope is hand-rolled here instead.
export async function getDueCount(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  const { count, error } = await supabase
    .from('topic_checks')
    .select('*', { head: true, count: 'exact' })
    .lte('due_at', now)
  if (error) {
    console.error('[getDueCount] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return count ?? 0
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
