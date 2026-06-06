import type { SupabaseClient } from '@supabase/supabase-js'

import { DEFAULT_DAILY_GOAL } from '@/features/settings/constants'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// RLS scopes the row to the owner, so no user_id filter. Coalesce null → DEFAULT_DAILY_GOAL as defense against a trigger gap / race.
export async function getDailyGoal(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.from('user_settings').select('daily_goal').maybeSingle()
  if (error) {
    console.error('[getDailyGoal] PostgREST error', error)
    throw new Error(error.message, { cause: error })
  }
  return data?.daily_goal ?? DEFAULT_DAILY_GOAL
}
