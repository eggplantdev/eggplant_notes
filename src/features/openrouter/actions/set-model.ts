'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { isAllowedModel } from '@/features/openrouter/catalog'
import { createClient } from '@/lib/supabase/create-server-client'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Persists the user's default model onto their existing credential row (the settings picker). UPDATE,
// not upsert — a model choice without a connected key is meaningless. Filtered by the authed user id
// (RLS also scopes it); off-list ids are rejected (same guard the per-generate override uses). The
// allowlist is the live catalog, so the membership check is async — done here, not in a zod refine.
const modelSchema = z.object({ modelId: z.string().min(1) })

export async function setOpenRouterModel(input: unknown): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Validate once here (not via runTableAction) — the async allowlist guard needs the parsed
  // modelId before the write, and the write isn't a single-row insert that helper is shaped for.
  const parsed = validateInput(modelSchema, input)
  if (!parsed.success) return parsed
  if (!(await isAllowedModel(parsed.data.modelId))) {
    return { success: false, error: 'Unknown model' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('openrouter_credentials')
    .update({ model: parsed.data.modelId })
    .eq('user_id', user.id)
    .select('model')
    // maybeSingle (not single): a model save with no credential row is a "connect first" case,
    // not a 500. The picker only renders when connected, so this is a latent guard.
    .maybeSingle()
  if (error) {
    console.error('[setOpenRouterModel] update error', error)
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Connect OpenRouter first.' }

  revalidatePath('/', 'layout')
  return { success: true }
}
