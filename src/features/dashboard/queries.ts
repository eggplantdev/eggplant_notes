import type { SupabaseClient } from '@supabase/supabase-js'

import { STATS_WINDOW_DAYS } from '@/features/dashboard/constants'
import { cardStatsSchema } from '@/features/dashboard/schemas'
import type { CardStatsT } from '@/features/dashboard/types'
import { runRpc } from '@/lib/supabase/run-rpc'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { APP_TIME_ZONE } from '@/lib/utils'

// Dashboard stat tiles + "needs attention" list in one round-trip. The card_stats RPC counts
// overdue/due/window-reviews and builds the top-5 hardest list in Postgres (SECURITY INVOKER, so
// RLS scopes every count to the owner) — replacing the old fetch-the-whole-deck reads. Returns a
// jsonb whose shape the RPC guarantees, so the cast is safe.
export async function getCardStats(client?: SupabaseClient<Database>): Promise<CardStatsT> {
  const supabase = client ?? (await createClient())
  const data = await runRpc('getCardStats', () =>
    supabase.rpc('card_stats', { p_time_zone: APP_TIME_ZONE, p_window_days: STATS_WINDOW_DAYS }),
  )
  return cardStatsSchema.parse(data)
}
