import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

import { runMaybeSingle } from '@/lib/supabase/run-maybe-single'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { pageRange } from '@/lib/utils/pagination'
import type {
  SubjectListItemT,
  SubjectNoteSummaryT,
  SubjectOptionT,
} from '@/features/subjects/types'
import type { SubjectT } from '@/types/subject'

// RLS scopes every row to the owner; the optional client is injectable so the isolation E2E can
// drive the same path with a per-account supabase-js client.

// Full unpaginated set for the subject `<select>`s + filter options — id/title only (every consumer
// maps to {value, label}, never reads other columns). The /subjects list page uses getSubjectsList.
export async function getSubjects(client?: SupabaseClient<Database>): Promise<SubjectOptionT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('subjects').select('id, title').order('created_at', { ascending: false }),
  )
}

// Backs the /subjects list page: slim columns, optional `?q=` search, paginated. Hand-rolled (not
// runTableQuery) to return the full match `total` off one `count: 'exact'` response. Separate from
// getSubjects, which must keep its full-set shape for its other callers.
export async function getSubjectsList(
  opts?: { q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: SubjectListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const { offset, limit } = pageRange(opts)
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
// cache()-wrapped: the /subjects/[id] layout and page both call this per request;
// cache() keys on args, dedupes them to one round-trip. The injected `client` (E2E
// only) defeats dedup harmlessly since prod calls pass none.
export const getSubject = cache(
  async (id: string, client?: SupabaseClient<Database>): Promise<SubjectT | undefined> => {
    const supabase = client ?? (await createClient())
    return runMaybeSingle(
      'getSubject',
      supabase.from('subjects').select('*').eq('id', id).maybeSingle(),
    )
  },
)

// Lightweight list for the docs-style sidebar nav: id/title/position only, never `content`.
// Ordered by `position` (nulls last, created_at tie-break; members always have a position, so
// nulls-last is defensive).
export const getSubjectNoteSummaries = cache(
  async (subjectId: string, client?: SupabaseClient<Database>): Promise<SubjectNoteSummaryT[]> => {
    const supabase = client ?? (await createClient())
    return runTableQuery(supabase, (c) =>
      c
        .from('notes')
        .select('id, title, position')
        .eq('subject_id', subjectId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    )
  },
)
