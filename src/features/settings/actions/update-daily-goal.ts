'use server'

import { revalidatePath } from 'next/cache'

import { dailyGoalSchema } from '@/features/settings/schemas'
import type { DailyGoalInputT } from '@/features/settings/schemas'
import { getCurrentUser } from '@/lib/supabase/server'
import { runTableAction } from '@/lib/supabase/run-table-action'
import type { ActionResultT } from '@/types/action'

// Persist the caller's daily goal. Upsert (not update) so a missing row self-heals — if the
// signup trigger never ran, the first save creates the row. user_id is taken from the authed
// client (not trusted from input) and is also the conflict target. RLS scopes the write to
// the owner. revalidatePath('/dashboard') so the progress bar reflects the new goal on the
// next dashboard view. Returns success/error (no redirect) for inline toasts.
export async function updateDailyGoal(input: DailyGoalInputT): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const result = await runTableAction(dailyGoalSchema, input, (supabase, data) =>
    supabase
      .from('user_settings')
      // updated_at is set by hand: there is no moddatetime trigger on user_settings, so without
      // this the column would only ever hold its insert-time default. Do not strip it.
      .upsert(
        { user_id: user.id, daily_goal: data.dailyGoal, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select('daily_goal')
      .single(),
  )
  if (!result.success) return result

  revalidatePath('/dashboard')
  return { success: true }
}
