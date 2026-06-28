'use server'

import { revalidatePath } from 'next/cache'

import { runAuthAction } from '@/features/auth/run-auth-action'
import { updatePasswordSchema } from '@/features/auth/schemas'
import type { ActionResultT } from '@/types/action'

export async function updatePassword(input: unknown): Promise<ActionResultT> {
  const result = await runAuthAction(updatePasswordSchema, input, (supabase, data) =>
    supabase.auth.updateUser({ password: data.password }),
  )
  if (!result.success) return result

  // The recovery flow lands here with a session established from the email link; drop any stale
  // client cache. The page navigates to /dashboard on success (a client-known URL).
  revalidatePath('/', 'layout')
  return { success: true }
}
