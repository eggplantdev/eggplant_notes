import type { Database } from '@/lib/supabase/types'

export type ReviewEventT = Database['public']['Tables']['review_events']['Row']
