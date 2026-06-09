import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// The list never shows the secret (only the hash is stored) — so name/created/last-used is the whole
// row contract. Revoked rows stay in the table as an audit trail but are filtered out of the UI.
export type ApiTokenListItemT = Pick<
  Database['public']['Tables']['api_tokens']['Row'],
  'id' | 'name' | 'created_at' | 'last_used_at'
>

// RLS scopes the select to the owner, so no user_id filter. Active tokens only (revoked_at is null).
export async function getApiTokens(): Promise<ApiTokenListItemT[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, name, created_at, last_used_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getApiTokens] select error', error)
    return []
  }
  return data ?? []
}
