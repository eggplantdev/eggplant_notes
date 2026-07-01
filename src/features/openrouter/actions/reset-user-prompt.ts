'use server'

import { revalidatePath } from 'next/cache'

import { userPromptSchema } from '@/features/openrouter/prompt-schemas'
import { createClient } from '@/lib/supabase/create-server-client'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
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

  // Bust the client Router Cache so the reverted-to-default prompt shows on the next cached revisit.
  // See save-user-prompt.ts — staleTimes.dynamic is now non-zero, so this is load-bearing.
  revalidatePath('/', 'layout')
  return { success: true }
}
