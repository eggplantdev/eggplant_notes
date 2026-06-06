import type { Database } from '@/lib/supabase/types'

export type SubjectT = Database['public']['Tables']['subjects']['Row']
