import type { Database } from '@/lib/supabase/types'

export type NoteT = Database['public']['Tables']['notes']['Row']
