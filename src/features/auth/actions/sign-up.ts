'use server'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { credentialsSchema } from '@/features/auth/schemas'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

export async function signUp(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(
    credentialsSchema,
    input,
    (supabase, data) => supabase.auth.signUp(data),
    // Don't reveal whether the email already has an account (user-enumeration). Supabase returns
    // "User already registered" here; collapse every sign-up auth error to one neutral message.
    () => 'Could not create your account. If you already have one, try signing in.',
  )
  if (!result.success) return result

  toastRedirect('/dashboard', 'signed-up')
}
