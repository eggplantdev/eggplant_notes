'use server'

import { revalidatePath } from 'next/cache'

import { dailyGoalSchema } from '@/features/settings/schemas'
import type { DailyGoalInputT } from '@/features/settings/schemas'
import { getCurrentUser } from '@/lib/supabase/server'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Upsert (not update) so a missing row self-heals if the signup trigger never ran. user_id comes
// from the authed client (not trusted from input) and is also the conflict target.
export async function updateDailyGoal(input: DailyGoalInputT): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const result = await runTableAction(dailyGoalSchema, input, (supabase, data) =>
    supabase
      .from('user_settings')
      // updated_at: moddatetime trigger bumps it on the DO UPDATE path; the insert path uses `default now()`.
      .upsert({ user_id: user.id, daily_goal: data.dailyGoal }, { onConflict: 'user_id' })
      .select('daily_goal')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/', 'layout')
  return { success: true }
}
