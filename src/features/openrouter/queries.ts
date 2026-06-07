import { createClient } from '@/lib/supabase/server'

// Whether the caller has connected OpenRouter — drives the gating of every AI surface (Phases 3-4).
// RLS scopes the row to the owner, so a bare select can only ever see the caller's own credential.
export async function isOpenRouterConnected(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('openrouter_credentials').select('user_id').maybeSingle()
  return Boolean(data)
}
