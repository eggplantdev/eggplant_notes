import { createClient } from '@/lib/supabase/server'

// Whether the caller has connected OpenRouter — drives the gating of every AI surface (Phases 3-4).
// RLS scopes the row to the owner, so a bare select can only ever see the caller's own credential.
export async function isOpenRouterConnected(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('openrouter_credentials').select('user_id').maybeSingle()
  return Boolean(data)
}

// The caller's chosen model (null → app default). The key itself is never read here — only server
// code that actually calls OpenRouter decrypts it (see server-client.ts).
export async function getOpenRouterModelChoice(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('openrouter_credentials').select('model').maybeSingle()
  return data?.model ?? null
}
