import type { Database } from '@/lib/supabase/types'

// Row type re-exported from the generated Database schema — single source of truth.
export type TopicCheckT = Database['public']['Tables']['topic_checks']['Row']
