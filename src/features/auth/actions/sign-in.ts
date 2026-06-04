'use server'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

export async function signIn(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(credentialsSchema, input, (supabase, data) =>
    supabase.auth.signInWithPassword(data),
  )
  if (!result.success) return result

  toastRedirect('/dashboard', 'signed-in')
}
