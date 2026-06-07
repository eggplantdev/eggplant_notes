'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { ActionResultT } from '@/types/action'

// Removes the caller's stored OpenRouter credential. RLS scopes the delete to the owner; the explicit
// user_id filter keeps it a single-row, intentional delete rather than a blanket one.
export async function disconnectOpenRouter(): Promise<ActionResultT> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not signed in' }

  const { error } = await supabase.from('openrouter_credentials').delete().eq('user_id', user.id)
  if (error) {
    console.error('[disconnectOpenRouter] delete error', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}
