'use server'

import { deleteSeededRows, revalidateSeedPaths } from '@/features/sample-data/seed-rows'
import { createClient } from '@/lib/supabase/create-server-client'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { ActionResultT } from '@/types/action'

// Delegates to deleteSeededRows — the same path the loader's rollback uses.
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
