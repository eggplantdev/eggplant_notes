import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteListItemT } from '@/features/notes/types'
import type { NoteT } from '@/types/note'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { DEFAULT_LIMIT } from '@/lib/utils/pagination'

// RLS scopes rows to the owner — no explicit `user_id` filter. Selects only the list-card columns
// (never `content`) so payloads stay slim. Hand-rolls the query rather than using runTableQuery
// because it needs the full match `total` off one `count: 'exact'` response (returns rows + total).
// The optional client is injectable so the isolation E2E can drive the same path with a per-account
// supabase-js client; app code passes none and gets the per-request server one.
export async function getNotes(
  opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: NoteListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit
  const orFilter = opts?.q ? searchOr(['title', 'content'], opts.q) : null

  // Build the filtered query; `head` toggles the rows-vs-count-only variant the 416 fallback reuses.
  const filtered = (head: boolean) => {
    let query = supabase
      .from('notes')
      .select('id, title, created_at, subjects(title)', { count: 'exact', head })
    if (opts?.subjectIds && opts.subjectIds.length > 0) {
      query = query.in('subject_id', opts.subjectIds)
    }
    if (orFilter) query = query.or(orFilter)
    return query
  }

  return runPaginatedQuery(
    'getNotes',
    filtered(false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    () => filtered(true),
  )
}

// Lean read for the dashboard stats: id/title only, never `content`. Injectable client per the
// isolation rule.
export async function getNotesForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) => c.from('notes').select('id, title'))
}

// RLS scopes to the owner, so a missing OR not-owned id both resolve to `undefined` (caller
// decides 404). Uses `maybeSingle` (no-match → null, no error), so it can't use runTableQuery,
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
