import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// Two cheap gating reads for the UI. `head: true` + `count: 'exact'` returns a count with NO row
// payload — the cheapest existence probe. RLS scopes both to the caller, so no user_id filter.
// The optional client mirrors the getNotes pattern: app code passes nothing (per-request server
// client); the isolation E2E injects a per-account supabase-js client to drive the same path.

export async function isAccountEmpty(client?: SupabaseClient<Database>): Promise<boolean> {
  const supabase = client ?? (await createClient())
  const [notes, subjects] = await Promise.all([
    supabase.from('notes').select('*', { count: 'exact', head: true }),
    supabase.from('subjects').select('*', { count: 'exact', head: true }),
  ])
  if (notes.error) throw new Error(notes.error.message, { cause: notes.error })
  if (subjects.error) throw new Error(subjects.error.message, { cause: subjects.error })
  return (notes.count ?? 0) === 0 && (subjects.count ?? 0) === 0
}

export async function hasSeededData(client?: SupabaseClient<Database>): Promise<boolean> {
  const supabase = client ?? (await createClient())
  const [notes, subjects] = await Promise.all([
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('is_seeded', true),
    supabase.from('subjects').select('*', { count: 'exact', head: true }).eq('is_seeded', true),
  ])
  if (notes.error) throw new Error(notes.error.message, { cause: notes.error })
  if (subjects.error) throw new Error(subjects.error.message, { cause: subjects.error })
  return (notes.count ?? 0) > 0 || (subjects.count ?? 0) > 0
}
