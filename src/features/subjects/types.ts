import type { Database } from '@/lib/supabase/types'

// Row type re-exported from the generated Database schema — single source of truth.
export type SubjectT = Database['public']['Tables']['subjects']['Row']
