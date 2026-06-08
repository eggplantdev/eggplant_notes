'use server'

import { userPromptSchema } from '@/features/openrouter/prompts'
import { revalidatePromptSurfaces } from '@/features/openrouter/actions/revalidate-prompt-surfaces'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Restore the built-in default for one key by deleting the user's override row (editable-system-prompts).
// Idempotent — a delete with no matching row is a no-op success, so resetting when nothing is saved
// (or a double-click) doesn't error. The resolver then falls back to the built-in constant.
const resetSchema = userPromptSchema.pick({ promptKey: true })

export async function resetUserPrompt(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(resetSchema, input)
  if (!parsed.success) return parsed

  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('user_prompts')
    .delete()
    .eq('user_id', user.id)
    .eq('prompt_key', parsed.data.promptKey)
  if (error) {
    console.error('[resetUserPrompt] PostgREST error', error)
    return { success: false, error: error.message }
  }

  revalidatePromptSurfaces()
  return { success: true }
}
