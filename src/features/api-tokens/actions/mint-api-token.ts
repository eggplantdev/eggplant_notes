'use server'

import { revalidatePath } from 'next/cache'

import { mintTokenSchema } from '@/features/api-tokens/schemas'
import type { MintTokenInputT } from '@/features/api-tokens/schemas'
import { generateToken } from '@/features/api-tokens/token'
import { createClient, getCurrentUser } from '@/lib/supabase/server'
import { validateInput } from '@/lib/validate'

// Mint is the one action that can't use runTableAction: it returns a SECRET, not a DB row. The raw
// token is generated in app code, shown to the caller exactly once, and never persisted (only the
// hash is stored) or re-fetchable. So the success branch widens ActionResultT to carry `rawToken`;
// `.success`/`.error` still flow through reportResult/toastActionResult unchanged.
export type MintTokenResultT =
  | { success: true; rawToken: string }
  | { success: false; error: string }

export async function mintApiToken(input: MintTokenInputT): Promise<MintTokenResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = validateInput(mintTokenSchema, input)
  if (!parsed.success) return parsed

  const { raw, hash } = generateToken()

  const supabase = await createClient()
  // user_id defaults to auth.uid() and the insert_own RLS policy pins it to the caller.
  const { error } = await supabase
    .from('api_tokens')
    .insert({ name: parsed.data.name, token_hash: hash })
  if (error) {
    // Never log `raw` or `hash` — the message is safe, the secret is not.
    console.error('[mintApiToken] insert error', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true, rawToken: raw }
}
