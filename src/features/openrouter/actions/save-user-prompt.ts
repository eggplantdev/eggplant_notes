'use server'

import { isBuiltinSystem } from '@/features/openrouter/system-prompts'
import { userPromptSchema } from '@/features/openrouter/prompt-schemas'
import { revalidatePromptSurfaces } from '@/features/openrouter/actions/revalidate-prompt-surfaces'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'
import type { ActionResultT } from '@/types/action'

// Persist a user's system-prompt override for one key (editable-system-prompts). If the submitted text
// equals the built-in default, DELETE any existing row instead of writing it — so saving the default
// verbatim re-attaches the user to future default changes rather than freezing a copy. user_id comes
// from the authed client (RLS also enforces it), never from input.
export async function saveUserPrompt(input: unknown): Promise<ActionResultT> {
  const parsed = validateInput(userPromptSchema, input)
  if (!parsed.success) return parsed
  const { promptKey, system } = parsed.data

  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = isBuiltinSystem(promptKey, system)
    ? await supabase
        .from('user_prompts')
        .delete()
        .eq('user_id', user.id)
        .eq('prompt_key', promptKey)
    : await supabase
        .from('user_prompts')
        // updated_at: moddatetime trigger bumps it on the DO UPDATE path; INSERT uses `default now()`.
        .upsert(
          { user_id: user.id, prompt_key: promptKey, system },
          { onConflict: 'user_id,prompt_key' },
        )
  if (error) {
    console.error('[saveUserPrompt] PostgREST error', error)
    return { success: false, error: error.message }
  }

  revalidatePromptSurfaces()
  return { success: true }
}
