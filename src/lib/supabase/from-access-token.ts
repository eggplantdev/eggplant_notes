import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

// Two cookie-less supabase-js clients for the token API (distinct from lib/supabase/server.ts, which is
// @supabase/ssr + next/headers cookies for the browser path).

// Runs every query as the user named in `jwt`: supabase-js sends it as `Authorization: Bearer <jwt>`,
// so RLS scopes reads/writes to that user. NOT elevated — an ordinary user client; the only elevated
// surface is resolve_api_token (SQL DEFINER).
export function clientForAccessToken(jwt: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: async () => jwt,
  })
}

// Unauthenticated client used solely to call resolve_api_token (granted to anon) before a user is known.
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
