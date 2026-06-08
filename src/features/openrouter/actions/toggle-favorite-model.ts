'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { isAllowedModel } from '@/features/openrouter/catalog'
import { getCredentialRow } from '@/features/openrouter/credential'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Adds/removes a model id from the caller's favorites (the picker's star toggle). Mirrors
// set-model.ts: UPDATE-only (favorites without a connected key are meaningless), user-scoped (RLS
// also scopes), off-list ids rejected by the same live-catalog allowlist. The shared ActionResultT
// is payload-less, so the picker reconciles its starred set from its own optimistic local state.
const modelSchema = z.object({ modelId: z.string().min(1) })

export async function toggleFavoriteModel(input: unknown): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = validateInput(modelSchema, input)
  if (!parsed.success) return parsed
  if (!(await isAllowedModel(parsed.data.modelId))) {
    return { success: false, error: 'Unknown model' }
  }

  const { modelId } = parsed.data
  const current = (await getCredentialRow())?.favorite_models ?? []
  const next = current.includes(modelId)
    ? current.filter((id) => id !== modelId)
    : [...current, modelId]

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('openrouter_credentials')
    .update({ favorite_models: next })
    .eq('user_id', user.id)
    .select('favorite_models')
    // maybeSingle (not single): a favorite toggle with no credential row is a "connect first" case,
    // not a 500. The picker only renders when connected, so this is a latent guard.
    .maybeSingle()
  if (error) {
    console.error('[toggleFavoriteModel] update error', error)
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'Connect OpenRouter first.' }

  revalidatePath('/settings')
  return { success: true }
}
