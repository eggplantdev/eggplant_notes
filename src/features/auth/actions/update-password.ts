'use server'

import { revalidatePath } from 'next/cache'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { updatePasswordSchema } from '@/features/auth/schemas'
import { toastRedirect } from '@/lib/toast-redirect'
import type { ActionResultT } from '@/types/action'

export async function updatePassword(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(updatePasswordSchema, input, (supabase, data) =>
    supabase.auth.updateUser({ password: data.password }),
  )
  if (!result.success) return result

  // The recovery flow lands here with a session established from the email link; drop any stale
  // client cache before redirecting to the dashboard. Before redirect — toastRedirect throws.
  revalidatePath('/', 'layout')
  toastRedirect('/dashboard', 'password-updated')
}
