'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/create-server-client'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { ActionResultT } from '@/types/action'

// Soft revoke (mirrors openrouter/disconnect): there is deliberately no delete policy on api_tokens,
// so we stamp revoked_at instead of removing the row — the audit trail survives. RLS scopes the
// update to the owner; the explicit id filter makes it a single intentional row.
export async function revokeApiToken(tokenId: string): Promise<ActionResultT> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
  if (error) {
    console.error('[revokeApiToken] update error', error.message)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
