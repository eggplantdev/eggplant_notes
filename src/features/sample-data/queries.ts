import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// The loader's guard: is the caller's account empty (zero notes AND zero subjects)? `head: true`
// + `count: 'exact'` returns a count with NO row payload — the cheapest existence probe. RLS
// scopes both to the caller, so no user_id filter. This runs only inside loadSampleData (on an
// explicit click), never on page render — the settings buttons are self-correcting, not gated by
// an eager read. The optional client mirrors the getNotes pattern so the isolation E2E can inject
// a per-account supabase-js client and drive the same guard.
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
