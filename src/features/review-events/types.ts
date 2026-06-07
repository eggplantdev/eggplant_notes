import type { Database } from '@/lib/supabase/types'

export type ReviewEventT = Database['public']['Tables']['review_events']['Row']

// One local calendar day's review tallies, from the review_day_counts RPC (snake_case → camelCase).
// `distinctCards` drives heatmap/streak/today; `totalEvents` drives the week count.
export type ReviewDayCountT = { date: string; distinctCards: number; totalEvents: number }
