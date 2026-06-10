import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteListItemT } from '@/features/notes/types'
import type { NoteT } from '@/types/note'
import { runMaybeSingle } from '@/lib/supabase/run-maybe-single'
import { runPaginatedQuery } from '@/lib/supabase/run-paginated-query'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { searchOr } from '@/lib/supabase/search-filter'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { pageRange } from '@/lib/utils/pagination'

// RLS scopes to owner — no user_id filter. Omits content intentionally (list-card columns only). Injectable client for E2E isolation.
export async function getNotes(
  opts?: { subjectIds?: string[]; q?: string; page?: number; limit?: number },
  client?: SupabaseClient<Database>,
): Promise<{ rows: NoteListItemT[]; total: number }> {
  const supabase = client ?? (await createClient())
  const { offset, limit } = pageRange(opts)
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

// RLS scopes to the owner, so a missing OR not-owned id both resolve to `undefined` (caller
// decides 404). Uses `maybeSingle` (no-match → null, no error), so it can't use runTableQuery,
// which throws on null data.
export async function getNote(
  id: string,
  client?: SupabaseClient<Database>,
): Promise<NoteT | undefined> {
  const supabase = client ?? (await createClient())
  return runMaybeSingle('getNote', supabase.from('notes').select('*').eq('id', id).maybeSingle())
}

// Scoped to one subject or IS NULL (unfiled) — getNotes lacks the IS NULL variant. Capped at 200 (subject scope is the real bound).
export async function getNotesForLinking(
  subjectId: string | null,
  client?: SupabaseClient<Database>,
): Promise<{ id: string; title: string | null }[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) => {
    const filtered = c.from('notes').select('id, title')
    const scoped =
      subjectId === null ? filtered.is('subject_id', null) : filtered.eq('subject_id', subjectId)
    return scoped.order('created_at', { ascending: false }).limit(200)
  })
}
