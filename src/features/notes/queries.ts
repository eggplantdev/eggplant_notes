import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteListItemT } from '@/features/notes/types'
import type { NoteT } from '@/types/note'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { DEFAULT_LIMIT } from '@/lib/utils/pagination'

// First data-access layer in the repo. Rows are scoped to the owner automatically by
// RLS — no explicit `user_id` filter needed. Selects only the columns the list card renders
// (id/title/created_at + the subjects(title) embed, typed via the notes→subjects FK) — never
// `content`, so list payloads stay slim at scale. `opts.subjectIds` (from the `?subjects=` URL
// filter) narrows to notes in those subjects; `opts.q` adds a case-insensitive search across
// title+content (composes AND with the subject filter). Paginated: returns the page's rows plus
// the full match `total` off one `count: 'exact'` response (the getDueQueue precedent — so it
// hand-rolls the query rather than going through runTableQuery, which returns rows only). The
// optional client is injectable so the isolation E2E can drive the same path with a per-account
// supabase-js client; app code calls it with no client and gets the per-request server one.
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

// Lean read backing the dashboard stats: every owned note, only the columns coverage stats
// need (id / title) — avoids pulling note `content` into the dashboard. RLS scopes rows to
// the owner. Injectable client per the isolation rule.
export async function getNotesForStats(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) => c.from('notes').select('id, title'))
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
