import type { SupabaseClient } from '@supabase/supabase-js'

import { getCredentialRow } from '@/features/openrouter/credential'
import { DEFAULT_OPENROUTER_MODEL } from '@/features/openrouter/constants'
import { BUILTIN_SYSTEM, type PromptKeyT } from '@/features/openrouter/prompts'
import { runTableQuery } from '@/lib/supabase/run-table-query'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

// Whether the caller has connected OpenRouter — drives the gating of every AI surface. Used by the
// nav (which only needs the boolean). Backed by the request-cached credential row, so this shares
// one read with the page status + credits badge instead of issuing its own.
export async function isOpenRouterConnected(): Promise<boolean> {
  return Boolean(await getCredentialRow())
}

// Connection + persisted default model — the AI pages need both (gating + the dialog's
// pre-selected model). defaultModel falls back to the hard default when unset/not connected.
export type OpenRouterStatusT = { connected: boolean; defaultModel: string }
export async function getOpenRouterStatus(): Promise<OpenRouterStatusT> {
  const data = await getCredentialRow()
  return { connected: Boolean(data), defaultModel: data?.model ?? DEFAULT_OPENROUTER_MODEL }
}

// Resolves every system prompt for the current user: their saved override per key, falling back to
// the built-in constant when no row exists (editable-system-prompts). The authoritative source for
// what the generate actions send AND what the dialog seeds — both read this, so they can't drift.
// RLS scopes the rows to the owner, so no user_id filter. Injectable client for tests.
export async function getResolvedSystemPrompts(
  client?: SupabaseClient<Database>,
): Promise<Record<PromptKeyT, string>> {
  const supabase = client ?? (await createClient())
  const rows = await runTableQuery(supabase, (c) =>
    c.from('user_prompts').select('prompt_key, system'),
  )
  const resolved = { ...BUILTIN_SYSTEM }
  for (const row of rows) {
    // The CHECK constraint guarantees prompt_key is a PromptKeyT; guard anyway so a stray value
    // can't widen the map with an unknown key.
    if (row.prompt_key in resolved) resolved[row.prompt_key as PromptKeyT] = row.system
  }
  return resolved
}
