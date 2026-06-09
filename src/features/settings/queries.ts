import type { SupabaseClient } from '@supabase/supabase-js'

import { DEFAULT_DAILY_GOAL } from '@/features/settings/constants'
import { runMaybeSingle } from '@/lib/supabase/run-maybe-single'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// RLS scopes the row to the owner, so no user_id filter. Coalesce null → DEFAULT_DAILY_GOAL as defense against a trigger gap / race.
// Explicit type arg: a single-column select doesn't infer the row type through runMaybeSingle's generic (the select('*') callers do).
export async function getDailyGoal(client?: SupabaseClient<Database>): Promise<number> {
  const supabase = client ?? (await createClient())
  const row = await runMaybeSingle<{ daily_goal: number }>(
    'getDailyGoal',
    supabase.from('user_settings').select('daily_goal').maybeSingle(),
  )
  return row?.daily_goal ?? DEFAULT_DAILY_GOAL
}
