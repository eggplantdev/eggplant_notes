'use server'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

export async function signUp(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(credentialsSchema, input, (supabase, data) =>
    supabase.auth.signUp(data),
  )
  if (!result.success) return result

  toastRedirect('/dashboard', 'signed-up')
}
