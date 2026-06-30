import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

import { runMaybeSingle } from '@/lib/supabase/run-maybe-single'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import type { SubjectNoteSummaryT, SubjectOptionT } from '@/features/subjects/types'
import type { SubjectT } from '@/types/subject'

// RLS scopes every row to the owner; the optional client is injectable so the isolation E2E can
// drive the same path with a per-account supabase-js client.

// Full unpaginated set for the subject `<select>`s, filter options, and the detail-view switcher —
// id/title only (every consumer maps to {value, label}, never reads other columns).
export async function getSubjects(client?: SupabaseClient<Database>): Promise<SubjectOptionT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('subjects').select('id, title').order('created_at', { ascending: false }),
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
// Ordered by `position` DESC so newest notes (position = Date.now() at insert) surface first;
// created_at DESC tie-break. Drag-to-reorder writes a fractional `position` (midpoint between the
// displayed neighbors), which is direction-agnostic, so DESC keeps manual ordering intact. `position`
// is non-null for every subject member, so nulls-last is defensive.
export const getSubjectNoteSummaries = cache(
  async (subjectId: string, client?: SupabaseClient<Database>): Promise<SubjectNoteSummaryT[]> => {
    const supabase = client ?? (await createClient())
    return runTableQuery(supabase, (c) =>
      c
        .from('notes')
        .select('id, title, position')
        .eq('subject_id', subjectId)
        .order('position', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
    )
  },
)
