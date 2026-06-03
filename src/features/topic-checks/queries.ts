import type { SupabaseClient } from '@supabase/supabase-js'

import type { TopicCheckT } from '@/features/topic-checks/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// Returns the owner's topic checks that are due (RLS scopes rows to the owner).
//
// As of S-03 (close-recall-loop) the review write path sets a future `due_at` via FSRS, so
// this returns only the genuinely-due checks (`due_at <= now()`). A freshly-created check
// has `due_at` defaulting to now(), so it is due immediately until its first review reschedules
// it. The `(user_id, due_at)` btree index backs this filter.
export async function getTopicChecksDue(client?: SupabaseClient<Database>): Promise<TopicCheckT[]> {
  const supabase = client ?? (await createClient())
  const now = new Date().toISOString()
  return runTableQuery(supabase, (c) =>
    c.from('topic_checks').select('*').lte('due_at', now).order('due_at', { ascending: true }),
  )
}

// Count of the owner's topic checks that are due now — the dashboard "Due today" stat. Uses a
// head + exact-count select so no row payload is fetched, with the same `due_at <= now()`
// filter as getTopicChecksDue. Injectable client per the isolation rule.
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
