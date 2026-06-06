'use server'

import { deleteSeededRows, revalidateSeedPaths } from '@/features/sample-data/seed-rows'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

// Remove exactly the caller's seeded rows, returning the account to empty. Delegates to the
// shared deleteSeededRows (same path the loader's rollback uses). No redirect — the caller
// surfaces the result via an inline toast.
export async function clearSampleData(): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await deleteSeededRows(supabase)
  if (error) {
    console.error('[clearSampleData]', error)
    return { success: false, error }
  }

  revalidateSeedPaths()
  return { success: true }
}
