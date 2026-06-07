import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/models'
import { createClient } from '@/lib/supabase/server'

// Whether the caller has connected OpenRouter — drives the gating of every AI surface. Used by the
// nav (which only needs the boolean). RLS scopes the row to the owner, so a bare select can only
// ever see the caller's own credential.
export async function isOpenRouterConnected(): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('openrouter_credentials').select('user_id').maybeSingle()
  return Boolean(data)
}

// Connection + persisted default model in ONE row read — the AI pages need both (gating + the
// dialog's pre-selected model), so don't split it into two queries against the same row.
// defaultModel falls back to the hard default when unset/not connected.
export type OpenRouterStatusT = { connected: boolean; defaultModel: string }
export async function getOpenRouterStatus(): Promise<OpenRouterStatusT> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('openrouter_credentials')
    .select('user_id, model')
    .maybeSingle()
  return { connected: Boolean(data), defaultModel: data?.model ?? DEFAULT_OPENROUTER_MODEL }
}
