import type { Database } from '@/lib/supabase/types'

// Subject row type, promoted to the shared tier on its 2nd consumer (subjects + notes features).
// Single source of truth: the generated Database schema.
export type SubjectT = Database['public']['Tables']['subjects']['Row']
