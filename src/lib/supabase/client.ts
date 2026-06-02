import { createBrowserClient } from '@supabase/ssr'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

// Browser-side Supabase client for use in client components.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
