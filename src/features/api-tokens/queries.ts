import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// The list never shows the secret (only the hash is stored) — so name/created/last-used is the whole
// row contract. Revoked rows stay in the table as an audit trail but are filtered out of the UI.
export type ApiTokenListItemT = Pick<
  Database['public']['Tables']['api_tokens']['Row'],
  'id' | 'name' | 'created_at' | 'last_used_at'
>

// Discriminated result, not a bare array: a read failure must NOT collapse to `[]`, which the UI would
// render as "no tokens yet" and invite a duplicate mint while the real (hashed) tokens sit untouched.
// `{ ok: false }` lets the section distinguish "you have none" from "we couldn't load them".
export type GetApiTokensResultT = { ok: true; tokens: ApiTokenListItemT[] } | { ok: false }

// RLS scopes the select to the owner, so no user_id filter.
export async function getApiTokens(): Promise<GetApiTokensResultT> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, name, created_at, last_used_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getApiTokens] select error', error)
    return { ok: false }
  }
  return { ok: true, tokens: data ?? [] }
}
