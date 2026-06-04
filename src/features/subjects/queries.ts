import type { SupabaseClient } from '@supabase/supabase-js'

import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import type { SubjectNoteSummaryT } from '@/features/subjects/types'
import type { SubjectT } from '@/types/subject'

// Read helpers mirror the notes feature: RLS scopes every row to the owner, and the
// optional client is injectable so the isolation E2E can drive the same path with a
// per-account supabase-js client.

export async function getSubjects(client?: SupabaseClient<Database>): Promise<SubjectT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('subjects').select('*').order('created_at', { ascending: false }),
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
