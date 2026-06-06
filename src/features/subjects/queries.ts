import type { SupabaseClient } from '@supabase/supabase-js'

import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { DEFAULT_LIMIT } from '@/lib/utils/pagination'
import type { SubjectListItemT, SubjectNoteSummaryT } from '@/features/subjects/types'
import type { SubjectT } from '@/types/subject'

// Read helpers mirror the notes feature: RLS scopes every row to the owner, and the
// optional client is injectable so the isolation E2E can drive the same path with a
// per-account supabase-js client.

// Full unpaginated set — 5 callers need it (the subject `<select>` on notes/new + notes/[id], the
// memory-cards/notes filter options). The /subjects list page uses getSubjectsList instead.
export async function getSubjects(client?: SupabaseClient<Database>): Promise<SubjectT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('subjects').select('*').order('created_at', { ascending: false }),
  )
}

// Backs the /subjects list page: slim columns the list card renders, an optional `?q=` search
// across title+description, paginated. Returns the page's rows + the full match `total` off one
// `count: 'exact'` response (the getDueQueue precedent — hand-rolled, not via runTableQuery).
// Separate from getSubjects, which must keep its full-set shape for its other callers. Injectable
// client per the isolation rule.
export async function getSubjectsList(
  opts?: { q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: SubjectListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const page = opts?.page ?? 1
  const limit = opts?.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit
  const orFilter = opts?.q ? searchOr(['title', 'description'], opts.q) : null

  // Build the filtered query; `head` toggles the rows-vs-count-only variant the 416 fallback reuses.
  const filtered = (head: boolean) => {
    let query = supabase
      .from('subjects')
      .select('id, title, description, created_at', { count: 'exact', head })
    if (orFilter) query = query.or(orFilter)
    return query
  }

  return runPaginatedQuery(
    'getSubjectsList',
    filtered(false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    () => filtered(true),
  )
}

// Single subject by id. Missing OR not-owned both resolve to `undefined` (caller
// decides 404), via `maybeSingle` — same contract as getNote.
export async function getSubject(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<SubjectT | undefined> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.from('subjects').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('[getSubject] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data ?? undefined
}

// Lightweight list backing the docs-style sidebar nav (S-15): only id/title/position, never
// `content` — the sidebar shows titles and the content pane fetches the active note's body
// via getNote. Ordered by `position` (nulls last, created_at tie-break; members always have a
// position, so nulls-last is defensive); mirrors getNotesForStats' lean read. RLS scopes rows
// to the owner; injectable client per the isolation rule.
export async function getSubjectNoteSummaries(
  subjectId: string,
  client?: SupabaseClient<Database>,
): Promise<SubjectNoteSummaryT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('notes')
      .select('id, title, position')
      .eq('subject_id', subjectId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  )
}
