import type { Database } from '@/lib/supabase/types'

// Note row type, promoted to the shared tier on its 2nd consumer (notes + subjects features).
// Single source of truth: the generated Database schema.
export type NoteT = Database['public']['Tables']['notes']['Row']
