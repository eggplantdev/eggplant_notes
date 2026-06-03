import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteT } from '@/features/notes/types'
import type { SubjectT } from '@/features/subjects/types'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

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

// Member notes of a subject, in user-defined order. `position` is the ordering key;
// nulls sort last and created_at breaks ties (members always have a position, so the
// nulls-last clause is defensive).
export async function getNotesForSubject(
  subjectId: string,
  client?: SupabaseClient<Database>,
): Promise<NoteT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c
      .from('notes')
      .select('*')
      .eq('subject_id', subjectId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  )
}

// Notes not assigned to any subject — the discoverable home for detached notes.
export async function getUnassignedNotes(client?: SupabaseClient<Database>): Promise<NoteT[]> {
  const supabase = client ?? (await createClient())
  return runTableQuery(supabase, (c) =>
    c.from('notes').select('*').is('subject_id', null).order('created_at', { ascending: false }),
  )
}
