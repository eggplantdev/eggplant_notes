import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteT } from '@/types/note'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// First data-access layer in the repo. Rows are scoped to the owner automatically by
// RLS — no explicit `user_id` filter needed. The optional client is injectable so the
// isolation E2E can drive the same query path with a per-account supabase-js client;
// app code calls it with no argument and gets the per-request server client.
export async function getNotes(client?: SupabaseClient<Database>): Promise<NoteT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('notes').select('*').order('created_at', { ascending: false }),
  )
}

// Lean read backing the dashboard stats: every owned note, only the columns coverage stats
// need (id / title / subject_id) — avoids pulling note `content` into the dashboard. RLS
// scopes rows to the owner. Injectable client per the isolation rule.
export async function getNotesForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) => c.from('notes').select('id, title, subject_id'))
}

// Fetch a single note by id. RLS already scopes to the owner, so a missing OR
// not-owned id both resolve to `undefined` (caller decides 404). Uses `maybeSingle`
// (no-match → `{ data: null, error: null }`), so it does NOT go through runTableQuery,
// which throws on null data.
export async function getNote(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<NoteT | undefined> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('[getNote] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data ?? undefined
}
