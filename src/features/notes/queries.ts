import type { SupabaseClient } from '@supabase/supabase-js'

import type { NoteT } from '@/features/notes/types'
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
